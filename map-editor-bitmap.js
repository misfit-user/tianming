// map-editor-bitmap.js
// 集成 map-recognition.js·image → polygon → divisions
// API·  recognizeMapByBorders / recognizeMapByBordersImproved / recognizeMapEU4Style
// flow·  user pick image → call recognition → preview → confirm import
// 2026-05-06

(function(global){
  'use strict';

  var ME = global.TM && global.TM.MapEditor;
  if (!ME){ console.error('[bitmap] core not loaded'); return; }

  // ─── pick image ──────────────────────────────────────────

  function pickImage(callback){
    var input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/png,image/jpeg,image/bmp,image/webp';
    input.onchange = function(e){
      var f = e.target.files && e.target.files[0];
      if (!f){ callback(null); return; }
      callback(f);
    };
    input.click();
  }

  // ─── progress modal ──────────────────────────────────────

  var _progressEl = null;
  function ensureProgress(){
    if (_progressEl) return _progressEl;
    _progressEl = document.createElement('div');
    _progressEl.style.cssText = 'position:fixed; left:50%; top:50%; transform:translate(-50%,-50%); z-index:99999; background:#1a1a1f; border:1px solid #3a3530; border-radius:6px; padding:18px 22px; min-width:320px; color:#e8ddc8; font-family:inherit; box-shadow:0 8px 30px rgba(0,0,0,0.6); display:none;';
    _progressEl.innerHTML = '\
      <div style="font-size:13px; color:#c9a96e; margin-bottom:8px;">自动识省进行中</div>\
      <div id="bm-progress-msg" style="font-size:11px; color:#a8a098; margin-bottom:8px;">准备...</div>\
      <div style="height:6px; background:#26262d; border-radius:3px; overflow:hidden;">\
        <div id="bm-progress-bar" style="height:100%; background:linear-gradient(90deg,#c9a96e,#d9b566); width:0%; transition:width 0.2s;"></div>\
      </div>\
      <div style="display:flex; gap:8px; margin-top:10px;">\
        <button class="me-btn me-btn-danger" id="bm-cancel" style="margin-left:auto;">取消</button>\
      </div>\
    ';
    document.body.appendChild(_progressEl);
    return _progressEl;
  }

  function showProgress(){
    var el = ensureProgress();
    el.style.display = 'block';
    var btn = document.getElementById('bm-cancel');
    if (btn) btn.onclick = function(){
      if (typeof global._cancelMapRecognition === 'function') global._cancelMapRecognition();
      hideProgress();
    };
  }

  function hideProgress(){
    if (_progressEl) _progressEl.style.display = 'none';
  }

  function updateProgress(msg, pct){
    var m = document.getElementById('bm-progress-msg');
    var b = document.getElementById('bm-progress-bar');
    if (m && msg) m.textContent = msg;
    if (b && pct != null) b.style.width = Math.round(pct * 100) + '%';
  }

  // ─── recognition options modal ───────────────────────────

  var _optsEl = null;
  function ensureOptsModal(){
    if (_optsEl) return _optsEl;
    _optsEl = document.createElement('div');
    _optsEl.style.cssText = 'position:fixed; left:50%; top:50%; transform:translate(-50%,-50%); z-index:9999; background:#1a1a1f; border:1px solid #3a3530; border-radius:6px; padding:14px 18px; min-width:380px; color:#e8ddc8; font-family:inherit; box-shadow:0 8px 30px rgba(0,0,0,0.6); display:none;';
    document.body.appendChild(_optsEl);
    return _optsEl;
  }

  function openOptsModal(file, callback){
    var modal = ensureOptsModal();
    modal.innerHTML = '\
      <div style="font-size:14px; color:#c9a96e; margin-bottom:10px;">自动识省·选算法</div>\
      <div style="font-size:11px; color:#6a6560; margin-bottom:12px;">从 ' + esc(file.name) + ' 提取 polygon·按色块自动分省</div>\
      \
      <div style="display:grid; gap:6px; margin-bottom:12px;">\
        <label class="me-bm-method" style="display:flex; gap:8px; align-items:flex-start; padding:8px; border:1px solid #3a3530; border-radius:3px; cursor:pointer;">\
          <input type="radio" name="bm-method" value="borders" checked style="margin-top:2px;" />\
          <div>\
            <div style="color:#c9a96e; font-size:12px;">边界识别 (推荐)</div>\
            <div style="color:#6a6560; font-size:10px;">检测色块间的黑/暗色边界·适古地图</div>\
          </div>\
        </label>\
        <label class="me-bm-method" style="display:flex; gap:8px; align-items:flex-start; padding:8px; border:1px solid #3a3530; border-radius:3px; cursor:pointer;">\
          <input type="radio" name="bm-method" value="bordersImproved" style="margin-top:2px;" />\
          <div>\
            <div style="color:#c9a96e; font-size:12px;">改良边界 (慢·更精)</div>\
            <div style="color:#6a6560; font-size:10px;">多 pass 检测·补漏·适复杂边</div>\
          </div>\
        </label>\
        <label class="me-bm-method" style="display:flex; gap:8px; align-items:flex-start; padding:8px; border:1px solid #3a3530; border-radius:3px; cursor:pointer;">\
          <input type="radio" name="bm-method" value="eu4" style="margin-top:2px;" />\
          <div>\
            <div style="color:#c9a96e; font-size:12px;">EU4 风格</div>\
            <div style="color:#6a6560; font-size:10px;">每色块 = 独立省·适标准化色彩 map (EU4 / CK 风)</div>\
          </div>\
        </label>\
        <label class="me-bm-method" style="display:flex; gap:8px; align-items:flex-start; padding:8px; border:1px solid #3a3530; border-radius:3px; cursor:pointer;">\
          <input type="radio" name="bm-method" value="regions" style="margin-top:2px;" />\
          <div>\
            <div style="color:#c9a96e; font-size:12px;">色域 flood-fill</div>\
            <div style="color:#6a6560; font-size:10px;">按相似色合区·适彩色历史地图</div>\
          </div>\
        </label>\
      </div>\
      \
      <div style="display:grid; grid-template-columns:auto 1fr; gap:6px 10px; margin-bottom:12px; align-items:center;">\
        <span style="font-size:11px; color:#6a6560;">tolerance</span>\
        <input type="number" id="bm-tolerance" value="10" min="1" max="100" style="background:#26262d; border:1px solid #3a3530; color:#e8ddc8; padding:4px 8px; border-radius:3px;" />\
        <span style="font-size:11px; color:#6a6560;">minArea·像素</span>\
        <input type="number" id="bm-minarea" value="200" min="10" max="100000" style="background:#26262d; border:1px solid #3a3530; color:#e8ddc8; padding:4px 8px; border-radius:3px;" />\
        <span style="font-size:11px; color:#6a6560;">simplify·边简化</span>\
        <label><input type="checkbox" id="bm-simplify" checked /> 启用 (RDP)</label>\
        <span style="font-size:11px; color:#6a6560;">简化强度·epsilon</span>\
        <input type="number" id="bm-epsilon" placeholder="留空=自动" min="0" max="20" step="0.5" style="background:#26262d; border:1px solid #3a3530; color:#e8ddc8; padding:4px 8px; border-radius:3px;" />\
        <span style="font-size:11px; color:#6a6560;">碎块并入</span>\
        <label><input type="checkbox" id="bm-mergefrag" /> 并入相邻最大块（去碎渣）</label>\
      </div>\
      \
      <div style="display:flex; gap:8px; justify-content:flex-end;">\
        <button class="me-btn" id="bm-cancel-opts">取消</button>\
        <button class="me-btn me-btn-warn" id="bm-go">开始识省</button>\
      </div>\
    ';
    modal.style.display = 'block';

    document.getElementById('bm-cancel-opts').onclick = function(){ modal.style.display = 'none'; };
    document.getElementById('bm-go').onclick = function(){
      var method = document.querySelector('input[name="bm-method"]:checked').value;
      var opts = {
        tolerance: Number(document.getElementById('bm-tolerance').value) || 10,
        minArea: Number(document.getElementById('bm-minarea').value) || 200,
        simplify: document.getElementById('bm-simplify').checked,
        epsilon: (function(){ var v = parseFloat((document.getElementById('bm-epsilon')||{}).value); return (isFinite(v) && v > 0) ? v : undefined; })(),
        mergeFragments: !!(document.getElementById('bm-mergefrag') && document.getElementById('bm-mergefrag').checked)
      };
      modal.style.display = 'none';
      callback(method, opts);
    };
  }

  // ─── recognize ──────────────────────────────────────────

  function recognize(file, method, opts){
    showProgress();
    updateProgress('载入图片·' + file.name, 0.05);

    var fn = null;
    if (method === 'borders' && typeof global.loadAndRecognizeMapByBorders === 'function'){
      fn = global.loadAndRecognizeMapByBorders;
    } else if (method === 'bordersImproved' && typeof global.loadAndRecognizeMapByBordersImproved === 'function'){
      fn = global.loadAndRecognizeMapByBordersImproved;
    } else if (method === 'eu4' && typeof global.loadAndRecognizeMapEU4Style === 'function'){
      fn = global.loadAndRecognizeMapEU4Style;
    } else if (method === 'regions' && typeof global.loadAndRecognizeMap === 'function'){
      fn = global.loadAndRecognizeMap;
    }

    if (!fn){
      hideProgress();
      meAlert('map-recognition.js 未加载或方法 "' + method + '" 不可用');
      return;
    }

    var progressCb = function(msg, pct){ updateProgress(msg, pct); };

    Promise.resolve(fn(file, opts, progressCb)).then(function(result){
      // 兼容两种返回·plain array of regions / { regions: [...] }
      var regions = Array.isArray(result) ? result : (result && result.regions) || [];
      hideProgress();
      if (regions.length === 0){
        meAlert('未识别到区域·调 tolerance / minArea / 换方法', 'warn');
        return;
      }
      // 转 division·preview 模态
      previewAndImport(regions, file, method, opts);
    }).catch(function(err){
      hideProgress();
      console.error('[bitmap] recognize fail:', err);
      meAlert('识省失败·' + (err && err.message ? err.message : '未知错'));
    });
  }

  // ─── preview + import ───────────────────────────────────

  function previewAndImport(regions, _file, _method, _opts){
    // 按色组聚类·相似 ≤ tolerance 视同色
    var groups = clusterByColor(regions, 30);
    var excludedColors = {};   // colorKey → bool
    var excludedIds = {};      // regionId → bool

    function rerender(){
      var modal = ensureOptsModal();
      var visibleRegions = regions.filter(function(r){
        if (excludedIds[r.id]) return false;
        var key = colorKey(r.color);
        if (excludedColors[key]) return false;
        return true;
      });

      var groupsHtml = groups.map(function(g, gi){
        var k = colorKey(g.color);
        var excluded = excludedColors[k];
        var nIn = g.regions.length;
        return '<label class="me-bm-grp" style="display:flex; gap:6px; align-items:center; padding:4px 6px; border-radius:3px; cursor:pointer; background:' + (excluded ? 'rgba(220,90,60,0.1)' : 'transparent') + '; opacity:' + (excluded ? '0.5' : '1') + ';">\
          <input type="checkbox" data-bm-grp-key="' + esc(k) + '"' + (excluded ? '' : ' checked') + ' />\
          <span style="display:inline-block; width:18px; height:14px; background:' + g.color + '; border:1px solid #3a3530; border-radius:2px;"></span>\
          <span style="font-size:10px; color:#a8a098;">' + g.color + ' · ' + nIn + ' 区</span>\
        </label>';
      }).join('');

      var listHtml = visibleRegions.slice(0, 40).map(function(r, i){
        var color = r.color || 'rgb(80,80,80)';
        var nVerts = (r.boundary || []).length;
        var area = r.area || 0;
        return '<div style="display:grid; grid-template-columns:24px 1fr auto auto auto; gap:8px; padding:5px 8px; border-bottom:1px solid #2a2a30; font-size:11px; align-items:center;">\
          <span style="display:inline-block; width:18px; height:14px; background:' + color + '; border:1px solid #3a3530; border-radius:2px;"></span>\
          <span>' + esc(r.name || ('区域·' + (r.id || i))) + '</span>\
          <span style="color:#6a6560; font-size:10px;">' + nVerts + ' 顶</span>\
          <span style="color:#6a6560; font-size:10px;">' + area + ' px²</span>\
          <button class="me-bm-rm" data-bm-rid="' + r.id + '" style="background:transparent; border:1px solid #5a2a20; color:#ff8a78; padding:1px 5px; border-radius:2px; cursor:pointer; font-size:10px;">×</button>\
        </div>';
      }).join('');

      modal.innerHTML = '\
        <div style="font-size:14px; color:#c9a96e; margin-bottom:6px;">识省结果·共 ' + regions.length + ' 区·选中 ' + visibleRegions.length + '</div>\
        <div style="font-size:11px; color:#6a6560; margin-bottom:10px;">勾选色组导入·或单删·或换合并选项</div>\
        \
        <div style="margin-bottom:10px;">\
          <div style="font-size:11px; color:#c9a96e; margin-bottom:4px;">色组 ' + groups.length + ' 类 (相似 ≤ 30)·勾 = 导入</div>\
          <div style="display:grid; grid-template-columns:repeat(auto-fill, minmax(140px, 1fr)); gap:4px; max-height:120px; overflow:auto; padding:4px; background:#15151a; border-radius:3px;">' + groupsHtml + '</div>\
        </div>\
        \
        <div style="max-height:240px; overflow:auto; border:1px solid #3a3530; border-radius:3px; margin-bottom:10px;">\
          ' + (listHtml || '<div style="padding:14px; color:#6a6560; text-align:center; font-size:10px;">(全部排除)</div>') + (visibleRegions.length > 40 ? '<div style="padding:8px; color:#6a6560; font-size:10px; text-align:center;">... 显前 40 / ' + visibleRegions.length + '</div>' : '') + '\
        </div>\
        \
        <div style="display:grid; grid-template-columns:auto 1fr; gap:6px 10px; margin-bottom:10px; align-items:center;">\
          <span style="font-size:11px; color:#6a6560;">同色合区</span>\
          <label><input type="checkbox" id="bm-merge-color" /> 启用·同色组合并为单 division (1 主 + 余飞地)</label>\
          <span style="font-size:11px; color:#6a6560;">导入策略</span>\
          <select id="bm-strategy" style="background:#26262d; border:1px solid #3a3530; color:#e8ddc8; padding:4px 8px; border-radius:3px; font-family:inherit;">\
            <option value="add">追加·保留现有省</option>\
            <option value="replace">替换·清空现有所有省</option>\
          </select>\
        </div>\
        <div style="display:flex; gap:8px; justify-content:flex-end;">\
          <button class="me-btn" id="bm-cancel-import">取消</button>\
          ' + (_file ? '<button class="me-btn" id="bm-rereco" title="换算法或调参数·重新识别">⟳ 调参重识</button>' : '') + '\
          <button class="me-btn me-btn-warn" id="bm-do-import">导入 ' + visibleRegions.length + ' 省</button>\
        </div>\
      ';
      modal.style.display = 'block';

      document.getElementById('bm-cancel-import').onclick = function(){ modal.style.display = 'none'; };
      var _rb = document.getElementById('bm-rereco');
      if (_rb) _rb.onclick = function(){ modal.style.display = 'none'; if (_file) openOptsModal(_file, function(_m, _o){ recognize(_file, _m, _o); }); };
      document.getElementById('bm-do-import').onclick = function(){
        var strategy = document.getElementById('bm-strategy').value;
        var mergeColor = document.getElementById('bm-merge-color').checked;
        modal.style.display = 'none';
        doImport(visibleRegions, strategy, mergeColor);
      };

      modal.querySelectorAll('[data-bm-grp-key]').forEach(function(cb){
        cb.onchange = function(){
          var k = cb.getAttribute('data-bm-grp-key');
          if (cb.checked) delete excludedColors[k];
          else excludedColors[k] = true;
          rerender();
        };
      });

      modal.querySelectorAll('[data-bm-rid]').forEach(function(b){
        b.onclick = function(){
          var rid = b.getAttribute('data-bm-rid');
          excludedIds[rid] = true;
          rerender();
        };
      });
    }

    rerender();
  }

  function colorKey(c){
    return String(c || '').replace(/\s+/g, '');
  }

  // 简单 RGB 距离聚类·tolerance ≤ thresh 同组
  function clusterByColor(regions, thresh){
    var groups = [];
    regions.forEach(function(r){
      var rgb = parseRgb(r.color);
      if (!rgb){
        // 无 color·独立组
        groups.push({ color: r.color || 'rgb(80,80,80)', regions: [r] });
        return;
      }
      var grp = null;
      for (var i = 0; i < groups.length; i++){
        var grgb = parseRgb(groups[i].color);
        if (!grgb) continue;
        var dr = rgb[0] - grgb[0], dg = rgb[1] - grgb[1], db = rgb[2] - grgb[2];
        if (Math.sqrt(dr*dr + dg*dg + db*db) <= thresh){
          grp = groups[i];
          break;
        }
      }
      if (grp){
        grp.regions.push(r);
      } else {
        groups.push({ color: r.color, regions: [r] });
      }
    });
    return groups;
  }

  function parseRgb(s){
    if (!s) return null;
    var m = /rgba?\((\d+),\s*(\d+),\s*(\d+)/.exec(s);
    if (!m) return null;
    return [Number(m[1]), Number(m[2]), Number(m[3])];
  }

  function doImport(regions, strategy, mergeColor){
    var dyn = TM.MapEditor.dynasty.get(ME.EDITOR.map.dynasty);
    var defaultAut = dyn.defaultAutonomy === 'mixed' ? 'zhixia' : (dyn.defaultAutonomy || 'zhixia');

    function regionToDiv(r, i, polygons){
      var d = ME.createDivision({
        name: r.name || ('识省 ' + (i + 1)),
        level: 'province',
        regionType: 'normal',
        terrain: dyn.defaultTerrain,
        polygon: polygons[0],
        extraPolygons: polygons.slice(1),
        autonomy: { type: defaultAut, subtype: '', holder: '', suzerain: '', loyalty: 80, tributeRate: 0 },
        byEthnicity: dyn.ethnicityDefault ? Object.assign({}, dyn.ethnicityDefault) : null,
        byFaith: dyn.faithDefault ? Object.assign({}, dyn.faithDefault) : null,
        description: '自动识省·色 ' + (r.color || '?')
      });
      ME.recomputeDerived(d);
      return d;
    }

    var newDivs;
    if (mergeColor){
      // 同色合并·按 color key 分组·each 组 = 1 division (主 + 飞地)
      var byColor = {};
      regions.forEach(function(r){
        var poly = (r.boundary || []).map(function(p){ return [p[0], p[1]]; });
        if (poly.length < 3) return;
        var k = colorKey(r.color);
        if (!byColor[k]) byColor[k] = { color: r.color, regions: [] };
        byColor[k].regions.push({ region: r, polygon: poly });
      });
      newDivs = Object.keys(byColor).map(function(k, i){
        var grp = byColor[k];
        // 主 polygon = 最大 area·余飞地
        var sorted = grp.regions.slice().sort(function(a, b){
          return ME.polygonArea(b.polygon) - ME.polygonArea(a.polygon);
        });
        var polygons = sorted.map(function(s){ return s.polygon; });
        return regionToDiv(sorted[0].region, i, polygons);
      });
    } else {
      newDivs = regions.map(function(r, i){
        var poly = (r.boundary || []).map(function(p){ return [p[0], p[1]]; });
        if (poly.length < 3) return null;
        return regionToDiv(r, i, [poly]);
      }).filter(Boolean);
    }

    ME.commitMutation('bitmap import ' + newDivs.length + ' divs', function(){
      if (strategy === 'replace'){
        ME.EDITOR.map.divisions = newDivs;
      } else {
        ME.EDITOR.map.divisions = ME.EDITOR.map.divisions.concat(newDivs);
      }
    });

    var statusEl = document.getElementById('status-tip');
    if (statusEl) statusEl.textContent = '识省导入·' + newDivs.length + ' 省·' + (mergeColor ? '同色合区·' : '') + 'strategy ' + strategy;
  }

  // ─── public·entry ───────────────────────────────────────

  function autoRecognize(){
    pickImage(function(file){
      if (!file) return;
      openOptsModal(file, function(method, opts){
        recognize(file, method, opts);
      });
    });
  }

  function esc(s){
    return String(s == null ? '' : s).replace(/[&<>"']/g, function(c){
      return ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c];
    });
  }

  // expose
  global.TM = global.TM || {};
  global.TM.MapEditor = global.TM.MapEditor || {};
  global.TM.MapEditor.bitmap = {
    autoRecognize: autoRecognize,
    pickImage: pickImage
  };

})(typeof window !== 'undefined' ? window : this);
