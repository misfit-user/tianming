'use strict';
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const Zip = require('../tm-zip-store.js');
const DataZip = require('../tm-data-zip.js');
const Formats = require('../tm-map-asset-formats.js');
const G = require('../tm-map-workbench.js');
const enc = new TextEncoder();
const bytes = (v) => enc.encode(typeof v === 'string' ? v : JSON.stringify(v));
const hash = (b) => crypto.createHash('sha256').update(b).digest('hex');
const ring = (x, y, w, h) => [
  [x, y],
  [x + w, y],
  [x + w, y + h],
  [x, y + h],
  [x, y],
];
const map = {
  schemaVersion: 'tm-map-asset/1',
  id: 'neutral',
  version: '1',
  coordinateSystemId: 'game-pixel',
  cells: [
    {
      id: 'islands',
      geometry: {
        type: 'MultiPolygon',
        coordinates: [
          [ring(0, 0, 10, 10), ring(2, 2, 2, 2)],
          [ring(20, 0, 10, 10), ring(22, 2, 2, 2)],
        ],
      },
    },
  ],
};
let count = 0;
async function test(name, fn) {
  await fn();
  count++;
  console.log('PASS ' + name);
}
(async () => {
  await test('multipart editor projection retains per-component holes even without geometry shortcut', () => {
    const projected = G.projection(map);
    assert.equal(projected.divisions[0].holes.length, 1);
    assert.equal(projected.divisions[0].extraPolygonHoles[0].length, 1);
    delete projected.divisions[0].geometry;
    const restored = Formats.normalize(projected, {
      coordinateSystemId: 'game-pixel',
      mapId: map.id,
      version: map.version,
    });
    assert.deepEqual(restored.cells[0].geometry, map.cells[0].geometry);
    assert(G.contains(restored.cells[0].geometry, [21, 1]));
    assert(!G.contains(restored.cells[0].geometry, [23, 3]));
  });
  await test('neutral pixel projection is explicit and invertible, ambiguous GeoJSON is refused', () => {
    const projection = {
      type: 'equirectangular',
      bbox: [66, -2, 150, 61],
      scale: 50.43478260869565,
      offset: [40, 40],
      units: 'map pixels; not longitude/latitude',
    };
    const point = [118.3, 31.2],
      restored = Formats.pixelToGeo(Formats.geoToPixel(point, projection), projection);
    assert(restored.every((n, i) => Math.abs(n - point[i]) < 1e-9));
    assert.throws(() => Formats.normalize({ type: 'FeatureCollection', features: [] }), /必须/);
  });
  await test('ZIP imports immutable license text and BOM with exact hashes, not an invented MIT grant', async () => {
    const notice = bytes('\uFEFFOriginal data LGPL-3.0-or-later; tools MIT.');
    const packed = Zip.buildZip([
      { name: 'map.json', data: bytes(map) },
      { name: 'licenses/COPYING.LESSER', data: notice },
    ]);
    const decoded = await Formats.decodeFile(packed, 'neutral.zip');
    assert.deepEqual(decoded.map.cells, map.cells);
    assert.equal(decoded.licenseCount, 1);
    assert.equal(hash(enc.encode(decoded.map.licenseDocuments[0].text)), hash(notice));
    assert.equal(decoded.map.importPackage.sha256, hash(packed));
  });
  await test('portable package reads every manifest hash and rejects a changed member', async () => {
    const entry = { name: 'map.json', data: bytes(map) };
    const manifest = {
      format: 'tm-native-authoring-package/1',
      files: [{ name: entry.name, byteLength: entry.data.length, sha256: hash(entry.data) }],
    };
    const make = () => Zip.buildZip([entry, { name: 'manifest.json', data: bytes(manifest) }]);
    assert.equal((await Formats.decodeFile(make(), 'package.zip')).map.id, map.id);
    manifest.files[0].sha256 = '0'.repeat(64);
    await assert.rejects(Formats.decodeFile(make(), 'package.zip'), /摘要/);
  });
  await test('ZIP refuses scripts, traversal, case-colliding names, corrupt CRC and cancellation', async () => {
    for (const name of ['../map.json', '/map.json', 'run.js']) {
      const archive = Zip.buildZip([{ name, data: bytes(map) }]);
      await assert.rejects(DataZip.read(archive));
    }
    await assert.rejects(
      DataZip.read(
        Zip.buildZip([
          { name: 'map.json', data: bytes(map) },
          { name: 'MAP.JSON', data: bytes(map) },
        ]),
      ),
    );
    const archive = Zip.buildZip([{ name: 'map.json', data: bytes(map) }]);
    archive[40] ^= 1;
    await assert.rejects(DataZip.read(archive));
    const controller = new AbortController();
    controller.abort();
    await assert.rejects(
      DataZip.read(Zip.buildZip([{ name: 'map.json', data: bytes(map) }]), { signal: controller.signal }),
    );
  });
  console.log(count + ' PASS / 0 FAIL');
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
