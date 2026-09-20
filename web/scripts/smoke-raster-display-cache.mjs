import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
const source = fs.readFileSync(process.env.TM_RASTER_SOURCE || fileURLToPath(new URL('../map-editor-rastermaps.js', import.meta.url)), 'utf8');
let passed = 0, failed = 0;
function check(name, fn) { try { fn(); passed++; console.log('PASS ' + name); } catch (e) { failed++; console.error('FAIL ' + name + ': ' + e.message); } }
function harness() {
  const count = { allocations: 0, convertedPixels: 0, saves: 0 }, images = [];
  class Canvas {
    constructor() { this.width = 0; this.height = 0; this.bytes = new Uint8ClampedArray(); }
    ensure() { if (this.bytes.length !== this.width * this.height * 4) this.bytes = new Uint8ClampedArray(this.width * this.height * 4); }
    getContext() { const c = this; return {
      fillRect() { c.ensure(); }, drawImage(img) { c.ensure(); if (img.bytes) c.bytes.set(img.bytes.subarray(0, c.bytes.length)); },
      createImageData(w, h) { count.allocations++; count.convertedPixels += w * h; return { width: w, height: h, data: new Uint8ClampedArray(w * h * 4) }; },
      getImageData(x, y, w, h) { c.ensure(); const data = new Uint8ClampedArray(w * h * 4); for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) data.set(c.bytes.subarray(((y+j)*c.width+x+i)*4, ((y+j)*c.width+x+i)*4+4), (j*w+i)*4); return { width: w, height: h, data }; },
      putImageData(img, x, y) { c.ensure(); for (let j = 0; j < img.height; j++) for (let i = 0; i < img.width; i++) c.bytes.set(img.data.subarray((j*img.width+i)*4, (j*img.width+i)*4+4), ((y+j)*c.width+x+i)*4); }
    }; }
    toDataURL() { count.saves++; return 'data:image/png;base64,' + Buffer.from(this.bytes).toString('base64'); }
  }
  const ME = { EDITOR: { map: { bitmapWidth: 8, bitmapHeight: 8 } }, requestRender() {} }, window = { TM: { MapEditor: ME } };
  const document = { createElement(tag) { assert.equal(tag, 'canvas'); return new Canvas(); } };
  class Image { constructor() { images.push(this); } }
  vm.runInNewContext(source, { window, document, Image, console, Uint8Array, Uint8ClampedArray, setTimeout });
  const api = ME.rastermaps, sink = { save() {}, restore() {}, drawImage(canvas) { this.last = canvas; } };
  function render(name) { api.renderLayer(sink, {}, name, { style: 'heatmap' }); return sink.last; }
  return { api, ME, count, render, images };
}
for (const name of ['terrainMap', 'heightMap']) {
  check(name + ': 60 unsaved frames reuse one conversion and preserve save dirtiness', () => {
    const h = harness(), L = h.api.ensureLayer(name); h.api.setPx(L, 2, 2, 2);
    const start = h.count.allocations, first = h.render(name); for (let i = 1; i < 60; i++) h.render(name);
    assert.equal(h.count.allocations - start, 1); assert.equal(h.render(name), first); assert.equal(L._dirty, true);
    h.api.commitAllDirty(); assert.equal(h.count.saves, 1); assert.equal(L._dirty, false); assert.equal(h.render(name), first);
  });
  check(name + ': edit then save before next render cannot reuse stale pixels', () => {
    const h = harness(), L = h.api.ensureLayer(name); h.api.setPx(L, 2, 2, 1); const first = h.render(name), old = Array.from(first.bytes);
    h.api.setPx(L, 2, 2, 2); h.api.saveToBase64(name); const next = h.render(name);
    assert.notEqual(next, first); assert.notDeepEqual(Array.from(next.bytes), old); assert.equal(L._dirty, false); assert.equal(h.render(name), next);
  });
  check(name + ': new data and exported rebuild invalidate display without dirty conflation', () => {
    const h = harness(), L = h.api.ensureLayer(name); h.api.setPx(L, 0, 0, 1); h.api.saveToBase64(name); const first = h.render(name);
    L._data = new Uint8Array(64).fill(2); const replaced = h.render(name); assert.notEqual(replaced, first);
    L._data[0] = 3; h.api.rebuildCanvas(L); assert.notEqual(h.render(name), replaced);
  });
  check(name + ': resize and recreated source canvas invalidate independently', () => {
    const h = harness(), L = h.api.ensureLayer(name); h.api.setPx(L, 0, 0, 1); h.api.saveToBase64(name); const first = h.render(name);
    L.width = 16; L._data = new Uint8Array(128).fill(2); const resized = h.render(name); assert.equal(resized.width, 16); assert.notEqual(resized, first);
    L._canvas = {}; assert.notEqual(h.render(name), resized);
  });
  check(name + ': cache metadata never enters serialized scenario', () => {
    const h = harness(), L = h.api.ensureLayer(name); h.api.setPx(L, 0, 0, 1); h.render(name);
    assert.equal(Object.keys(L).some(k => k.startsWith('_')), false); assert.equal(JSON.stringify(L).includes('Canvas'), false);
  });
}
check('terrain: palette changes refresh saved layers', () => {
  const h = harness(), L = h.api.ensureLayer('terrainMap'); L.palette = { 1: { color: [10, 20, 30] } };
  h.api.setPx(L, 0, 0, 1); h.api.saveToBase64('terrainMap'); const first = h.render('terrainMap');
  L.palette[1].color[0] = 99; const next = h.render('terrainMap'); assert.notEqual(next, first); assert.equal(next.bytes[0], 99);
});
check('late image decode refreshes an already displayed clean layer', () => {
  const h = harness(); h.ME.EDITOR.map.terrainMap = { width: 8, height: 8, dataB64: 'test' };
  const L = h.api.ensureLayer('terrainMap'), first = h.render('terrainMap');
  h.images[0].bytes = new Uint8ClampedArray(256).fill(255); h.images[0].bytes[0] = 2; h.images[0].onload();
  assert.notEqual(h.render('terrainMap'), first); assert.equal(L._dirty, false);
});
check('all 256 terrain and height values preserve pixel output', () => {
  const h = harness(); h.ME.EDITOR.map.bitmapWidth = 256; h.ME.EDITOR.map.bitmapHeight = 1;
  for (const name of ['terrainMap', 'heightMap']) {
    const L = h.api.ensureLayer(name); L._data = Uint8Array.from({ length: 256 }, (_, i) => i); h.api.rebuildCanvas(L);
    const bytes = h.render(name).bytes;
    for (let v = 0; v < 256; v++) {
      let expected = [0, 0, 0, 0];
      if (name === 'terrainMap') { const e = h.api.TERRAIN_PALETTE[v]; if (v && e) expected = [...e.color, 255]; }
      else if (v) { const t = v / 255; expected = t < .25 ? [0, Math.round(t*4*255), 255, 200] : t < .5 ? [0, 255, Math.round((.5-t)*4*255), 200] : t < .75 ? [Math.round((t-.5)*4*255), 255, 0, 200] : [255, Math.round((1-t)*4*255), 0, 200]; }
      assert.deepEqual(Array.from(bytes.subarray(v*4, v*4+4)), expected);
    }
  }
});
console.log(JSON.stringify({ passed, failed })); process.exitCode = failed ? 1 : 0;
