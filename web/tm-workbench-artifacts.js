// Actual portable artifacts, read back from the same immutable project asset store.
(function (root) {
  'use strict';
  var enc = new TextEncoder(),
    decoder = new TextDecoder('utf-8', { fatal: true });
  function store() {
    return root.TM.ProjectAssets;
  }
  function fail(code, message) {
    var e = new Error(message);
    e.code = code;
    throw e;
  }
  function json(v) {
    return enc.encode(JSON.stringify(v, null, 2));
  }
  function csv(v) {
    var s = String(v == null ? '' : v);
    if (/^[\s]*[=+@-]/.test(s)) s = "'" + s;
    return '"' + s.replace(/"/g, '""') + '"';
  }
  function markdown(v) {
    return String(v == null ? '' : v)
      .replace(/[\\`*_{}[\]<>|]/g, '\\$&')
      .replace(/\r?\n/g, ' ');
  }
  function noCredentials(s) {
    function walk(v, path) {
      if (!v || typeof v !== 'object') return;
      Object.keys(v).forEach(function (k) {
        if (
          /^(apiKey|api_key|authorization|access_token|refresh_token|password|tm_api)$/i.test(k) ||
          (/^(key|url|model)$/i.test(k) && /(^|\.)(ai|apiConfig|apiSettings)\./i.test(path + '.'))
        )
          fail('artifact-private-config', '制品包含 API/凭据配置字段：' + path + '.' + k);
        walk(v[k], path + '.' + k);
      });
    }
    walk(s, 'scenario');
  }
  function packageNames(entries) {
    var names = new Set(),
      total = 0;
    entries.forEach(function (e) {
      if (
        !/^(scenario\.json|map\.json|editor-map\.json|binding\.json|report\.(json|csv|md)|manifest\.json|LICENSE\.txt|preview\.png|licenses\/(COPYING(?:\.LESSER)?|README\.md|V13-PHYSICAL-NOTICE\.md|MIT-TOOLS\.txt|LICENSE(?:\.txt|\.md)?))$/.test(
          e.name,
        ) ||
        names.has(e.name)
      )
        fail('artifact-zip-path', '数据包包含未批准或重复条目');
      names.add(e.name);
      if (!(e.data instanceof Uint8Array)) fail('artifact-bytes', 'ZIP 条目必须是真实字节');
      total += e.data.length;
    });
    if (total > 128 * 1024 * 1024) fail('artifact-zip-size', '数据包超过 128 MiB 预算');
    return total;
  }
  function reportRows(bundle) {
    return [['region_id', 'name', 'controller_id', 'population', 'households']].concat(
      ((bundle.scenario.map && bundle.scenario.map.regions) || []).map(function (r) {
        return [
          r.id,
          r.name || '',
          r.controllerFactionId || r.sovereignFactionId || '',
          r.population == null ? '' : r.population,
          r.households == null ? '' : r.households,
        ];
      }),
    );
  }
  function binding(s) {
    return {
      schemaVersion: 'tm-scenario-map-binding/1',
      scenarioId: s.id,
      mapRef: (s.nativeStart && s.nativeStart.mapRef) || null,
      regions: (s.map && s.map.regions) || [],
      adminHierarchy: s.adminHierarchy || {},
    };
  }
  function validateBytes(format, b, expected) {
    if (!(b instanceof Uint8Array) || !b.length) fail('artifact-empty', '制品为空');
    var parsed;
    if (['scenario', 'map', 'editor-map', 'binding', 'report-json'].indexOf(format) >= 0) {
      parsed = JSON.parse(decoder.decode(b));
      if (format === 'scenario') {
        noCredentials(parsed);
        if (!parsed.id || !Array.isArray(parsed.characters) || !Array.isArray(parsed.factions))
          fail('artifact-scenario', '原生剧本缺 ID/人物/势力');
        if (expected && expected.map) {
          var r = root.TM.MapBindingWorkbench.inspect(parsed, expected.map);
          if (!r.ok) fail('artifact-binding', '剧本地图引用无法回导');
        }
      }
      if (format === 'map') root.TM.MapWorkbench.validate(parsed);
      if (
        format === 'editor-map' &&
        (!Array.isArray(parsed.divisions) ||
          parsed.divisions.some(function (d) {
            return !d.id || !d.geometry;
          }))
      )
        fail('artifact-editor-map', '编辑器投影缺逻辑地块与多面原件');
    } else if (format === 'png') {
      if (b.length < 24 || b[0] !== 137 || b[1] !== 80 || b[2] !== 78 || b[3] !== 71)
        fail('artifact-png', '预览不是 PNG');
    } else if (format === 'zip') {
      var entries = root.TMZipStore.parseZip(b);
      packageNames(entries);
      var by = new Map(
        entries.map(function (e) {
          return [e.name, e.data];
        }),
      );
      ['scenario.json', 'map.json', 'binding.json', 'manifest.json', 'LICENSE.txt'].forEach(function (n) {
        if (!by.has(n)) fail('artifact-zip-missing', '制作包缺少 ' + n);
      });
      root.TM.MapWorkbench.validate(JSON.parse(decoder.decode(by.get('map.json'))));
      validateBytes('scenario', by.get('scenario.json'), { map: JSON.parse(decoder.decode(by.get('map.json'))) });
      var manifest = JSON.parse(decoder.decode(by.get('manifest.json')));
      if (!manifest.files || !manifest.files.length) fail('artifact-zip-manifest', '制作包缺字节目录');
      return {
        ok: true,
        entries: entries.map(function (e) {
          return e.name;
        }),
        importable: true,
      };
    } else if (format !== 'csv' && format !== 'markdown') fail('artifact-format', '不支持的制品格式');
    else decoder.decode(b);
    return {
      ok: true,
      importable: ['scenario', 'map', 'editor-map', 'binding'].indexOf(format) >= 0,
      structure: format,
      byteLength: b.length,
    };
  }
  async function build(project, bundle, format, options) {
    options = options || {};
    noCredentials(bundle.scenario);
    var rootBody = await store().getProject(project),
      rootMeta = store().rootMeta(rootBody),
      worldHash = await store().hash(json(bundle.scenario)),
      mapHash = await store().hash(json(bundle.map)),
      bind = binding(bundle.scenario),
      bindingHash = await store().hash(json(bind)),
      data,
      type,
      name,
      report = bundle.report || {};
    var provenance = {
      generator: 'tm-workbench-artifacts/1',
      generatorHash: options.producerHash || null,
      taskId: options.taskId || null,
      projectId: project,
      projectRevision: rootMeta.revision,
      inputWorldHash: worldHash,
      inputMapHash: mapHash,
      inputBindingHash: bindingHash,
      profileId: options.profileId || null,
      license: bundle.map.license || '未声明；仅供项目作者核验，不能视为第三方再分发授权',
      sources: bundle.map.sources || [],
      dependencies: ((bundle.scenario.nativeStart && bundle.scenario.nativeStart.assets) || []).map(function (a) {
        return a.assetId;
      }),
    };
    var reportWorld = report.worldHash || (report.input && report.input.worldHash);
    if (reportWorld && reportWorld !== (await store().hash(enc.encode(JSON.stringify(bundle.scenario)))))
      fail('artifact-report-stale', '测试报告属于其他草稿，不能认证本制品');
    if (format === 'scenario') {
      data = json(bundle.scenario);
      type = 'application/json';
      name = 'scenario.json';
    } else if (format === 'map') {
      data = json(bundle.map);
      type = 'application/json';
      name = 'map.json';
    } else if (format === 'editor-map') {
      data = json(root.TM.MapWorkbench.projection(bundle.map));
      type = 'application/json';
      name = 'editor-map.json';
    } else if (format === 'binding') {
      data = json(bind);
      type = 'application/json';
      name = 'binding.json';
    } else if (format === 'report-json') {
      data = json({ provenance: provenance, report: report });
      type = 'application/json';
      name = 'report.json';
    } else if (format === 'csv') {
      data = enc.encode(
        '\ufeff' +
          reportRows(bundle)
            .map(function (row) {
              return row.map(csv).join(',');
            })
            .join('\r\n'),
      );
      type = 'text/csv;charset=utf-8';
      name = 'report.csv';
    } else if (format === 'markdown') {
      data = enc.encode(
        '# 天命案卷核查表\n\n输入世界 SHA-256：' +
          worldHash +
          '\n\n' +
          reportRows(bundle)
            .map(function (row, i) {
              return '| ' + row.map(markdown).join(' | ') + ' |' + (i === 0 ? '\n| --- | --- | --- | --- | --- |' : '');
            })
            .join('\n') +
          '\n\n许可：' +
          markdown(provenance.license) +
          '\n\n' +
          JSON.stringify(report, null, 2),
      );
      type = 'text/markdown;charset=utf-8';
      name = 'report.md';
    } else if (format === 'png') {
      var preview = bundle.preview;
      if (
        !preview ||
        preview.renderer !== 'phase8-formal-map' ||
        !/^data:image\/png;base64,/.test(preview.dataUrl || '')
      )
        fail('artifact-native-preview-required', 'PNG 必须来自同快照的正式地图渲染器');
      data = Uint8Array.from(root.atob(preview.dataUrl.split(',')[1]), function (c) {
        return c.charCodeAt(0);
      });
      if ((await store().hash(data)) !== preview.contentHash) fail('artifact-preview-hash', '原生 PNG 摘要不符');
      if (preview.inputWorldHash !== worldHash)
        fail('artifact-preview-stale', 'PNG 只认证原始输入快照；当前草稿已变，必须重画');
      type = 'image/png';
      name = 'preview.png';
    } else if (format === 'zip') {
      var entries = [
        { name: 'scenario.json', data: json(bundle.scenario) },
        { name: 'map.json', data: json(bundle.map) },
        { name: 'editor-map.json', data: json(root.TM.MapWorkbench.projection(bundle.map)) },
        { name: 'binding.json', data: json(bind) },
        { name: 'report.json', data: json(report) },
        { name: 'LICENSE.txt', data: enc.encode(String(provenance.license)) },
      ];
      for (var license of bundle.map.licenseDocuments || []) {
        var licenseBytes = enc.encode(license.text);
        if ((await store().hash(licenseBytes)) !== license.sha256)
          fail('artifact-license-hash', '许可原文摘要不符，未生成制作包');
        entries.push({ name: 'licenses/' + license.filename, data: licenseBytes });
      }
      if (bundle.preview) {
        var p = Uint8Array.from(root.atob(bundle.preview.dataUrl.split(',')[1]), function (c) {
          return c.charCodeAt(0);
        });
        if ((await store().hash(p)) !== bundle.preview.contentHash) fail('artifact-preview-hash', '预览字节变动');
        entries.push({ name: 'preview.png', data: p });
      }
      var manifest = Object.assign({}, provenance, { format: 'tm-native-authoring-package/1', files: [] });
      for (var i = 0; i < entries.length; i++)
        manifest.files.push({
          name: entries[i].name,
          byteLength: entries[i].data.length,
          sha256: await store().hash(entries[i].data),
        });
      entries.push({ name: 'manifest.json', data: json(manifest) });
      packageNames(entries);
      data = root.TMZipStore.buildZip(entries);
      type = 'application/zip';
      name = 'tianming-authoring.zip';
    } else fail('artifact-format', '不支持的制品格式');
    var validation = validateBytes(format, data, bundle),
      receipt = await store().putAsset(
        project,
        data,
        Object.assign({}, provenance, {
          kind: 'artifact',
          format: format,
          mediaType: type,
          filename: name,
          validation: validation,
        }),
        options,
      ),
      aid = receipt.artifacts[0].assetId;
    await validate(project, aid);
    return {
      ok: true,
      staged: !receipt.replayed,
      receipt: receipt,
      artifactId: aid,
      format: format,
      byteLength: data.length,
      validation: validation,
    };
  }
  async function validate(project, aid) {
    var a = await store().getAsset(project, aid);
    if (a.meta.kind !== 'artifact') fail('artifact-kind', '该资产不是制品');
    var r = validateBytes(a.meta.format, a.bytes);
    if (a.meta.format === 'zip') {
      var entries = root.TMZipStore.parseZip(a.bytes),
        manifest = JSON.parse(
          decoder.decode(
            entries.find(function (e) {
              return e.name === 'manifest.json';
            }).data,
          ),
        );
      for (var i = 0; i < manifest.files.length; i++) {
        var expected = manifest.files[i],
          found = entries.find(function (e) {
            return e.name === expected.name;
          });
        if (!found || found.data.length !== expected.byteLength || (await store().hash(found.data)) !== expected.sha256)
          fail('artifact-zip-readback', 'ZIP 条目回读摘要不符：' + expected.name);
      }
    }
    return Object.assign(r, { artifactId: aid, contentHash: a.meta.hash, byteLength: a.bytes.length });
  }
  async function exportFile(project, aid, options) {
    if (!options || options.userApproved !== true)
      fail('artifact-export-approval', '导出须由玩家点击批准，模型不能指定系统路径');
    await validate(project, aid);
    var a = await store().getAsset(project, aid);
    if (root.tianming && typeof root.tianming.exportArtifact === 'function') {
      var result = await root.tianming.exportArtifact(a.bytes, {
        filename: a.meta.filename,
        sha256: a.meta.hash,
        mediaType: a.meta.mediaType,
      });
      if (result.canceled) return { ok: false, cancelled: true, retained: true };
      if (!result.success || result.sha256 !== a.meta.hash || result.byteLength !== a.bytes.length)
        fail('artifact-export-write', '写盘或回读未确认；候选仍保留');
      return { ok: true, status: 'saved-and-readback-verified', artifactId: aid, sha256: result.sha256 };
    }
    if (root.showSaveFilePicker) {
      try {
        var handle = await root.showSaveFilePicker({ suggestedName: a.meta.filename }),
          stream = await handle.createWritable();
        try {
          await stream.write(a.bytes);
          await stream.close();
        } catch (e) {
          try {
            await stream.abort();
          } catch (_) {}
          throw e;
        }
        var back = new Uint8Array(await (await handle.getFile()).arrayBuffer());
        if ((await store().hash(back)) !== a.meta.hash) fail('artifact-export-readback', '保存后的文件摘要不符');
        return { ok: true, status: 'saved-and-readback-verified', artifactId: aid };
      } catch (e) {
        if (e.name === 'AbortError') return { ok: false, cancelled: true, retained: true };
        if (handle || !['SecurityError', 'NotSupportedError'].includes(e.name)) throw e;
      }
    }
    var url = URL.createObjectURL(new Blob([a.bytes], { type: a.meta.mediaType })),
      link = document.createElement('a');
    link.href = url;
    link.download = a.meta.filename;
    document.body.append(link);
    link.click();
    link.remove();
    setTimeout(function () {
      URL.revokeObjectURL(url);
    }, 30000);
    return {
      ok: true,
      status: 'handed-to-browser-download',
      note: '已交给浏览器下载，不能保证用户已保存',
      artifactId: aid,
    };
  }
  root.TM = root.TM || {};
  root.TM.WorkbenchArtifacts = {
    build: build,
    validate: validate,
    validateBytes: validateBytes,
    exportFile: exportFile,
    packageNames: packageNames,
    binding: binding,
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = root.TM.WorkbenchArtifacts;
})(typeof window !== 'undefined' ? window : globalThis);
