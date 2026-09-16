// A panel inside the existing editor, not an external demo or second agent.
(function (root) {
  'use strict';
  var panel,
    body,
    active,
    selectedProfile = '';
  function app() {
    return root.TM_SCENARIO_EDITOR_RESET_APP;
  }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function message(text) {
    if (panel) panel.querySelector('[data-wb-status]').textContent = text;
  }
  function context() {
    return root.TM.Workbench.capture({ signal: active && active.signal });
  }
  function showResult(r) {
    var out = panel.querySelector('[data-wb-result]');
    out.textContent = JSON.stringify(r, null, 2).slice(0, 32000);
    if (JSON.stringify(r).length > 32000) out.textContent += '\n（界面摘要已截断；完整制品可单独导出）';
  }
  async function refresh() {
    var a = app(),
      pid = a.state.currentProjectId,
      rows = pid ? await root.TM.ProjectAssets.listAssets(pid) : [],
      tasks = pid ? await root.TM.ProjectAssets.listTasks(pid) : [];
    if (!panel || !panel.open) return;
    var profiles = (a.state.scenario.nativeStart && a.state.scenario.nativeStart.profiles) || [];
    body.innerHTML =
      '<div class="tm-wb-top"><div><small>制作案房 · 当前案卷</small><h2>' +
      esc(a.state.scenario.name || '未命名') +
      '</h2><p>' +
      (pid
        ? '第 ' + esc((a.state.workbenchRoot && a.state.workbenchRoot.revision) || 0) + ' 修订 · ' + esc(pid)
        : '请先保存到案卷库；不会修改正式游戏或其他案卷') +
      '</p></div><button data-wb="save">保存当前案卷</button></div>' +
      '<div class="tm-wb-actions"><label class="tm-wb-file">导入中立地图／制作包<input type="file" data-wb-file="map" accept=".zip,.json,.geojson"></label><label class="tm-wb-file">导入参考资料<input type="file" data-wb-file="source" accept=".txt,.md,.csv,.json,.pdf,.png,.jpg,.jpeg,.webp"></label><button data-wb="checks">全案核查</button><label>开局身份 <select data-wb-profile>' +
      profiles
        .map(function (p) {
          return (
            '<option value="' +
            esc(p.id) +
            '"' +
            (p.id === selectedProfile ? ' selected' : '') +
            '>' +
            esc(p.id) +
            ' · ' +
            esc(p.playerCharacterId) +
            '</option>'
          );
        })
        .join('') +
      '</select></label><button data-wb="preview">原生地图预览</button><button data-wb="sandbox">原生财政三期测试</button></div>' +
      '<p class="tm-wb-hint">地图计算在本地 Worker 执行；不会自动填湖、吞并内嵌地块或复制兵队。参考资料中的文字不是操作指令。PDF／图片可入库，未配提取器时如实标为待提取。</p>' +
      '<div class="tm-wb-columns"><section><h3>项目资产与制品</h3><div class="tm-wb-actions"><select data-wb-format><option value="scenario">原生剧本 JSON</option><option value="map">中立地图 JSON</option><option value="editor-map">中性编辑器投影</option><option value="binding">地图绑定 JSON</option><option value="csv">CSV 核查表</option><option value="markdown">Markdown 核查表</option><option value="zip">ZIP 制作包</option><option value="png">原生 PNG 预览</option></select><button data-wb="build">生成并回读</button></div><div class="tm-wb-assets">' +
      (rows.length
        ? rows
            .map(function (r) {
              return (
                '<article><div><strong>' +
                esc(r.title || r.filename || r.kind) +
                '</strong><small>' +
                esc(r.assetId) +
                ' · ' +
                Math.ceil(r.byteLength / 1024) +
                ' KiB</small></div><div>' +
                (r.kind === 'proposal'
                  ? '<button data-wb="apply" data-id="' + esc(r.assetId) + '">整包审阅并应用</button>'
                  : '') +
                (r.kind === 'artifact'
                  ? '<button data-wb="export" data-id="' + esc(r.assetId) + '">导出</button>'
                  : '') +
                '<button data-wb="inspect-asset" data-id="' +
                esc(r.assetId) +
                '">详情</button></div></article>'
              );
            })
            .join('')
        : '<p>尚无项目资产。先导入底图或通过国师生成候选。</p>') +
      '</div></section>' +
      '<section><h3>地图操作候选</h3><p>也可直接对现有国师说“检查地图、提出修改并验证”；以下入口供作者精确录入操作包。</p><textarea data-wb-operations rows="8" spellcheck="false" placeholder="[{ &quot;type&quot;: &quot;renameDisplay&quot;, &quot;regionId&quot;: &quot;地块ID&quot;, &quot;name&quot;: &quot;新显示名&quot; }]"></textarea><label>中立地图资产 ID（剧本已绑定时可留空）<input data-wb-map-id></label><button data-wb="propose">计算候选，不改当前案卷</button><h3>持久任务</h3><input data-wb-task-request placeholder="要继续制作的目标"><label>最多 API 请求（0 = 仅本地；重试也计数）<input data-wb-task-calls type="number" value="0" min="0" max="50"></label><label>只准改这些地块 ID（逗号分隔；留空不限地块）<input data-wb-task-regions placeholder="例如：海南中部诸峒"></label><button data-wb="task-create">创建有限预算任务</button>' +
      tasks
        .map(function (t) {
          return (
            '<article><div><strong>' +
            esc(t.request || t.taskId) +
            '</strong><small>' +
            esc(t.status) +
            ' · 请求 ' +
            t.used.calls +
            '/' +
            t.budget.calls +
            '</small></div><button data-wb="task-resume" data-id="' +
            esc(t.taskId) +
            '">恢复</button><button data-wb="task-cancel" data-id="' +
            esc(t.taskId) +
            '">取消</button></article>'
          );
        })
        .join('') +
      '</section></div>' +
      '<section class="tm-wb-observation"><h3>本次真实结果</h3><div data-wb-preview></div><pre data-wb-result>未运行。旧报告不代表当前快照已经通过。</pre></section>';
  }
  async function perform(action, button) {
    if (active) return;
    active = new AbortController();
    try {
      message('正在处理…');
      var a = app(),
        pid = a.state.currentProjectId,
        ctx = context(),
        draft = JSON.parse(JSON.stringify(a.state.scenario)),
        profile = body.querySelector('[data-wb-profile]');
      selectedProfile = (profile && profile.value) || '';
      var input = { operationId: root.TM.ProjectAssets.uid('ui'), profileId: selectedProfile },
        r;
      if (action === 'save') {
        r = await a.saveProjectSnapshot(a.state.scenario.name);
        await refresh();
        message('案卷已保存并回读');
        return;
      }
      if (!pid) throw Error('请先保存当前案卷');
      if (action === 'checks') r = await root.TM.Workbench.dispatch('runScenarioChecks', input, draft, ctx);
      if (action === 'sandbox')
        r = await root.TM.Workbench.dispatch('runSandbox', Object.assign(input, { fiscalPeriods: 3 }), draft, ctx);
      if (action === 'preview') {
        r = await root.TM.Workbench.sandbox(draft, ctx, Object.assign(input, { preview: true }));
        if (r.preview) {
          var image = document.createElement('img');
          image.src = r.preview.dataUrl;
          image.alt = '同快照原生地图渲染 · 隔离宿主 · 无真实模型';
          image.style.width = '100%';
          body.querySelector('[data-wb-preview]').replaceChildren(image);
          r = Object.assign({}, r, {
            preview: {
              renderer: r.preview.renderer,
              contentHash: r.preview.contentHash,
              width: r.preview.width,
              height: r.preview.height,
              hitRegions: r.preview.hitRegions,
            },
          });
        }
      }
      if (action === 'build') {
        input.format = body.querySelector('[data-wb-format]').value;
        r = await root.TM.Workbench.dispatch('buildArtifact', input, draft, ctx);
        await refresh();
      }
      if (action === 'propose') {
        input.operations = JSON.parse(body.querySelector('[data-wb-operations]').value);
        input.mapAssetId = body.querySelector('[data-wb-map-id]').value || undefined;
        r = await root.TM.Workbench.dispatch('proposeMapOperations', input, draft, ctx);
        await refresh();
      }
      if (action === 'apply') {
        r = await root.TM.Workbench.dispatch('applyMapOperations', { proposalId: button.dataset.id }, draft, ctx);
        if (r.ok) {
          r = await root.TM.Workbench.commitDraft(draft, { lease: ctx.lease });
          await refresh();
        }
      }
      if (action === 'export')
        r = await root.TM.WorkbenchArtifacts.exportFile(pid, button.dataset.id, { userApproved: true });
      if (action === 'inspect-asset') {
        var asset = await root.TM.ProjectAssets.getAsset(pid, button.dataset.id);
        r = asset.meta;
      }
      if (action === 'task-create') {
        var calls = Number(body.querySelector('[data-wb-task-calls]').value),
          request = body.querySelector('[data-wb-task-request]').value;
        r = await root.TM.ProjectAssets.createTask(pid, {
          request: request,
          allowedRegionIds: body.querySelector('[data-wb-task-regions]').value.trim()
            ? body
                .querySelector('[data-wb-task-regions]')
                .value.split(/[,、\n]/)
                .map(function (id) {
                  return id.trim();
                })
                .filter(Boolean)
            : null,
          budget: { calls: calls, inputBytes: 96 * 1024 * 1024, artifactBytes: 128 * 1024 * 1024, concurrency: 1 },
        });
        await refresh();
      }
      if (action === 'task-cancel') {
        r = await root.TM.ProjectAssets.taskChange(pid, button.dataset.id, 'cancel');
        await refresh();
      }
      if (action === 'task-resume') {
        var ui = root.TM_AuthoringAgentUI && root.TM_AuthoringAgentUI._ui;
        if (ui && ui.running) throw Error('请先停止当前国师任务');
        r = await root.TM.ProjectAssets.taskChange(pid, button.dataset.id, 'resume', { authorized: true });
        if (ui) {
          ui._workbenchTask = { taskId: r.taskId, generation: r.generation, projectId: pid };
          ui._workbenchCheckpoint = await root.TM.Workbench.restoreTask(r);
          ui.els.req.value = r.request || '继续制作任务 ' + r.taskId;
        }
        await refresh();
        r = {
          ok: true,
          taskId: r.taskId,
          budget: r.budget,
          note: '已重新取得任务租约；关闭工作台后在国师中发送继续指令，预算耗尽不会自动扩额',
        };
      }
      if (r) showResult(r);
      message(r && r.ok === false ? '有未完成项，详见真实结果；未覆盖其他案卷' : '处理完成；详情见下方结果');
    } catch (e) {
      message('未完成：' + e.message);
      showResult({ ok: false, code: e.code || 'workbench-failed', message: e.message, details: e.details || [] });
    } finally {
      active = null;
    }
  }
  async function importFile(event) {
    var input = event.target,
      file = input.files && input.files[0];
    if (!file || active) return;
    active = new AbortController();
    try {
      var ctx = context();
      if (!ctx) throw Error('请先保存当前案卷');
      if (file.size > root.TM.ProjectAssets.maxBytes) throw Error('资料超过本地预算');
      var b = new Uint8Array(await file.arrayBuffer()),
        kind = input.dataset.wbFile,
        type = file.type || 'application/octet-stream',
        processing = 'requires-extraction';
      if (kind === 'map') {
        var originalBytes = b,
          decoded = await root.TM.MapAssetFormats.decodeFile(b, file.name, { signal: active.signal }),
          map = decoded.map;
        var geometryReport = await root.TM.MapWorkbenchClient.run(
          'inspect',
          { map: map, options: {} },
          { signal: active.signal },
        );
        if (!geometryReport.ok) throw Error('底图存在几何冲突，未认证为可用地图；请先查看并修正原文件');
        b = new TextEncoder().encode(JSON.stringify(map));
        await root.TM.ProjectAssets.putAsset(
          ctx.projectId,
          originalBytes,
          { kind: 'map-original', title: file.name, mediaType: decoded.originalMediaType, untrusted: true },
          {
            signal: active.signal,
            guard: function () {
              return app().isDocumentLeaseCurrent(ctx.lease, true);
            },
          },
        );
        type = 'application/json';
        processing = 'validated-geometry';
      } else if (/\.(txt|md|csv|json)$/i.test(file.name)) {
        root.TM.ProjectAssets.decode(b);
        type = /\.json$/i.test(file.name) ? 'application/json' : 'text/plain';
        processing = 'text-ready';
      }
      var receipt = await root.TM.ProjectAssets.putAsset(
        ctx.projectId,
        b,
        {
          kind: kind,
          title: file.name,
          filename: file.name,
          mediaType: type,
          license: kind === 'map' ? map.license : '作者导入，许可待核',
          processingStatus: processing,
          importedAt: new Date().toISOString(),
          untrusted: true,
        },
        {
          signal: active.signal,
          guard: function () {
            return app().isDocumentLeaseCurrent(ctx.lease, true);
          },
        },
      );
      await refresh();
      showResult(receipt);
      message('原始资产已写入并回读校验，尚未改变剧本绑定');
    } catch (e) {
      message('导入未完成：' + e.message);
    } finally {
      active = null;
      input.value = '';
    }
  }
  function open() {
    if (panel) {
      panel.showModal();
      refresh().catch(function (e) {
        message(e.message);
      });
      return;
    }
    var style = document.createElement('style');
    style.textContent =
      '.tm-wb{width:min(1220px,94vw);max-height:90vh;overflow:auto;border:1px solid #ad925b;border-radius:12px;background:#f6f0df;color:#392f24;font:15px/1.6 system-ui;box-shadow:0 22px 80px #0007;padding:24px}.tm-wb::backdrop{background:#18140eb0}.tm-wb h2{margin:4px 0;font-family:serif;font-size:28px}.tm-wb h3{border-bottom:1px solid #d2bf95;padding-bottom:8px}.tm-wb button,.tm-wb select,.tm-wb input,.tm-wb textarea{font:inherit;color:inherit;background:#fffaf0;border:1px solid #baa677;border-radius:5px;padding:8px;box-sizing:border-box}.tm-wb button{cursor:pointer;background:#efe1bd}.tm-wb button:focus-visible{outline:3px solid #914639}.tm-wb textarea{display:block;width:100%;resize:vertical}.tm-wb label{display:block}.tm-wb-top,.tm-wb-actions,.tm-wb article{display:flex;gap:12px;align-items:center;justify-content:space-between}.tm-wb-actions{flex-wrap:wrap;justify-content:flex-start}.tm-wb article{padding:12px 0;border-bottom:1px solid #dacbaa}.tm-wb small{display:block;color:#716047;overflow-wrap:anywhere}.tm-wb-hint{color:#695a43}.tm-wb-columns{display:grid;grid-template-columns:1fr 1fr;gap:28px}.tm-wb-file input{display:block;max-width:220px}.tm-wb pre{white-space:pre-wrap;overflow-wrap:anywhere;max-height:420px;overflow:auto;background:#fffaf0;padding:16px}.tm-wb [data-wb-status]{position:sticky;top:-24px;padding:12px;background:#e9dcc0;border-bottom:1px solid #b09a6b}.tm-wb [data-wb-close]{float:right;background:#792e28;color:#fff8e8}@media(max-width:800px){.tm-wb-columns{grid-template-columns:1fr}}';
    document.head.append(style);
    style.textContent +=
      '.tm-wb [data-wb-status]{position:static;margin-top:0;padding-right:100px}.tm-wb [data-wb-close]{position:sticky;top:0;z-index:2}';
    panel = document.createElement('dialog');
    panel.className = 'tm-wb';
    panel.id = 'tm-workbench-panel';
    panel.setAttribute('aria-label', '原生制作工作台');
    panel.innerHTML =
      '<button data-wb-close>关闭</button><p data-wb-status>本地制作工作台 · 不发版、不覆盖正式游戏</p><div data-wb-body></div>';
    body = panel.querySelector('[data-wb-body]');
    document.body.append(panel);
    panel.querySelector('[data-wb-close]').onclick = function () {
      if (active) active.abort();
      panel.close();
    };
    panel.addEventListener('cancel', function () {
      if (active) active.abort();
    });
    panel.addEventListener('click', function (e) {
      var b = e.target.closest('[data-wb]');
      if (b) perform(b.dataset.wb, b);
    });
    panel.addEventListener('change', function (e) {
      if (e.target.matches('[data-wb-file]')) importFile(e);
    });
    panel.showModal();
    refresh().catch(function (e) {
      message(e.message);
    });
  }
  function install() {
    var nav = document.querySelector('.top-actions');
    if (!nav || document.getElementById('tm-workbench-open')) return;
    var b = document.createElement('button');
    b.id = 'tm-workbench-open';
    b.className = 'icon-btn';
    b.type = 'button';
    b.title = '原生制作工作台：地图、资产、核查与续做';
    b.setAttribute('aria-label', b.title);
    b.textContent = '工';
    b.onclick = open;
    nav.append(b);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install, { once: true });
  else install();
  root.TM = root.TM || {};
  root.TM.WorkbenchUI = { open: open, refresh: refresh };
})(typeof window !== 'undefined' ? window : globalThis);
