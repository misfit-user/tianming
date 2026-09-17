// Forward-only import adapters. Original bytes remain assets; no scenario/political state is invented.
(function (root) {
  'use strict';
  function fail(message) {
    var e = new Error(message);
    e.code = 'map-format';
    throw e;
  }
  function copy(value) {
    return JSON.parse(JSON.stringify(value));
  }
  function finitePair(p) {
    return Array.isArray(p) && p.length === 2 && p.every(Number.isFinite);
  }
  function geoToPixel(point, projection) {
    if (
      !finitePair(point) ||
      !projection ||
      projection.type !== 'equirectangular' ||
      !Array.isArray(projection.bbox) ||
      projection.bbox.length !== 4 ||
      !Number.isFinite(projection.scale) ||
      projection.scale <= 0 ||
      !finitePair(projection.offset)
    )
      fail('需要完整等距圆柱投影参数');
    return [
      (point[0] - projection.bbox[0]) * projection.scale + projection.offset[0],
      (projection.bbox[3] - point[1]) * projection.scale + projection.offset[1],
    ];
  }
  function pixelToGeo(point, p) {
    geoToPixel([0, 0], p);
    if (!finitePair(point)) fail('坐标无效');
    return [(point[0] - p.offset[0]) / p.scale + p.bbox[0], p.bbox[3] - (point[1] - p.offset[1]) / p.scale];
  }
  function normalize(value, options) {
    options = options || {};
    var m = copy(value),
      sourceSchema = m.schemaVersion || m.schema || m.type || 'editor';
    if (m.schemaVersion === 'tm-map-asset/1' && m.coordinateSystemId) return m;
    if (m.schema === 'tm-reusable-map/1') {
      if (!m.projection || !/map pixels/.test(m.projection.units || ''))
        fail('可复用底图须明确像素坐标声明，不能猜经纬度');
      geoToPixel([0, 0], m.projection);
      m.schemaVersion = 'tm-map-asset/1';
      m.coordinateSystemId = 'game-pixel';
      m.width = m.view && m.view.width;
      m.height = m.view && m.view.height;
      m.cells.forEach(function (c) {
        if (!c.name) c.name = c.defaultName || c.id;
      });
      var precision = m.provenance && m.provenance.v14GapAudit && m.provenance.v14GapAudit.coordinatesPrecisionPixels;
      if (Number.isFinite(precision) && precision > 0)
        m.topologyParameters = { coordinateTolerance: precision, minSharedLength: precision * 4 };
    } else if (m.type === 'FeatureCollection') {
      if (!options.coordinateSystemId || !options.mapId || !options.version)
        fail('独立 FeatureCollection 必须由作者指定坐标类型、地图 ID 和版本；本包 GeoJSON 是游戏像素');
      m = {
        schemaVersion: 'tm-map-asset/1',
        id: options.mapId,
        version: options.version,
        coordinateSystemId: options.coordinateSystemId,
        cells: m.features.map(function (f) {
          if (!f.properties || !f.properties.id) fail('Feature 缺稳定逻辑 ID');
          return { id: f.properties.id, name: f.properties.name || f.properties.id, geometry: copy(f.geometry) };
        }),
      };
    } else if (Array.isArray(m.divisions)) {
      if (!options.coordinateSystemId || !options.mapId || !options.version)
        fail('编辑器投影需作者明确坐标、地图 ID 和版本');
      m = {
        schemaVersion: 'tm-map-asset/1',
        id: options.mapId,
        version: options.version,
        coordinateSystemId: options.coordinateSystemId,
        width: m.bitmapWidth || m.width,
        height: m.bitmapHeight || m.height,
        cells: m.divisions.map(function (d) {
          var polygons = [[d.polygon].concat(d.holes || [])].concat(
            (d.extraPolygons || []).map(function (r, i) {
              return [r].concat((d.extraPolygonHoles || [])[i] || []);
            }),
          );
          return {
            id: d.logicalRegionId || d.id,
            name: d.name || d.id,
            geometry: d.geometry || { type: 'MultiPolygon', coordinates: polygons },
            labelPoint: d.centroid || d.labelPoint,
          };
        }),
      };
    } else fail('不支持的地图格式；未覆盖已有资产');
    m.importProvenance = {
      sourceSchema: sourceSchema,
      adapter: 'tm-map-asset-formats/1',
      sourceDeclaredContentHash: value.contentHash || null,
      forwardOnly: true,
    };
    delete m.contentHash;
    if (!m.license)
      m.license =
        '原数据许可未附入此 JSON；请随制作包保留来源包的 COPYING、COPYING.LESSER 与 NOTICE，不得将地理派生数据全部宣称为 MIT';
    if (value.version != null) m.version = String(value.version) + '-native';
    return m;
  }
  async function decodeFile(bytes, filename, options) {
    options = options || {};
    var decoder = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }),
      map,
      entries;
    function parse(data) {
      return JSON.parse(decoder.decode(data).replace(/^\uFEFF/, ''));
    }
    async function hash(data) {
      return Array.from(new Uint8Array(await root.crypto.subtle.digest('SHA-256', data)))
        .map(function (n) {
          return n.toString(16).padStart(2, '0');
        })
        .join('');
    }
    if (/\.zip$/i.test(filename)) {
      if (!root.TM || !root.TM.DataZip) fail('数据包解压组件不可用');
      entries = await root.TM.DataZip.read(bytes, options);
      var candidates = entries
        .filter(function (e) {
          return /(^|\/)([^/]*atlas[^/]*\.json|map\.json)$/i.test(e.name);
        })
        .map(function (e) {
          return { entry: e, value: parse(e.data) };
        })
        .filter(function (row) {
          return row.value.schema === 'tm-reusable-map/1' || row.value.schemaVersion === 'tm-map-asset/1';
        });
      if (candidates.length !== 1) fail('数据包须包含唯一明确的中立 atlas/map.json，不猜选剧本数据');
      var manifestEntry = entries.find(function (e) {
        return e.name === 'manifest.json';
      });
      if (manifestEntry) {
        var manifest = parse(manifestEntry.data);
        if (manifest.format === 'tm-native-authoring-package/1') {
          if (!Array.isArray(manifest.files) || manifest.files.length !== entries.length - 1)
            fail('制作包字节清单不完整');
          var seen = new Set();
          for (var row of manifest.files) {
            var member = entries.find(function (e) {
              return e.name === row.name;
            });
            if (
              !member ||
              seen.has(row.name) ||
              member.data.length !== row.byteLength ||
              (await hash(member.data)) !== row.sha256
            )
              fail('制作包条目摘要不符');
            seen.add(row.name);
          }
        }
      }
      map = normalize(candidates[0].value, options);
      var licenses = entries.filter(function (e) {
        return /(^|\/)licenses\/(COPYING(?:\.LESSER)?|README\.md|V13-PHYSICAL-NOTICE\.md|MIT-TOOLS\.txt|LICENSE(?:\.txt|\.md)?)$/i.test(
          e.name,
        );
      });
      if (licenses.length) {
        map.licenseDocuments = [];
        for (var item of licenses)
          map.licenseDocuments.push({
            filename: item.name.split('/').pop(),
            text: decoder.decode(item.data),
            sha256: await hash(item.data),
          });
        map.license =
          '原包地理数据许可及来源见 licenses/COPYING、COPYING.LESSER、README 与 NOTICE；工具 MIT 不覆盖地理数据许可。';
      }
      map.importPackage = {
        filename: filename,
        sha256: await hash(bytes),
        mapEntry: candidates[0].entry.name,
        licenseCount: licenses.length,
      };
    } else map = normalize(parse(bytes), options);
    return {
      map: map,
      originalMediaType: entries ? 'application/zip' : 'application/json',
      licenseCount: (map.licenseDocuments || []).length,
    };
  }
  root.TM = root.TM || {};
  root.TM.MapAssetFormats = {
    normalize: normalize,
    decodeFile: decodeFile,
    geoToPixel: geoToPixel,
    pixelToGeo: pixelToGeo,
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = root.TM.MapAssetFormats;
})(typeof window !== 'undefined' ? window : globalThis);
