import {edit} from './patch-utils.mjs';
edit('web/scripts/smoke-perf-save-preparation.js',(s,r)=>{
 s=r(s,"const names = ['绍宋·建炎元年八月（官方）.json', '天启七年·九月（官方）.json'];",`// Compare every character, but never build a multi-gigabyte automatic diff on failure.
function equalComplete(actual, expected, label) {
  if (actual === expected) return;
  let offset = 0; while (offset < actual.length && offset < expected.length && actual[offset] === expected[offset]) offset++;
  throw new Error(label + ' at character ' + offset + '; lengths ' + actual.length + '/' + expected.length + '; actual=' + JSON.stringify(actual.slice(Math.max(0, offset - 80), offset + 160)) + '; expected=' + JSON.stringify(expected.slice(Math.max(0, offset - 80), offset + 160)));
}
const names = ['绍宋·建炎元年八月（官方）.json', '天启七年·九月（官方）.json'];`);
 s=r(s,"assert.equal(JSON.stringify(actual), JSON.stringify(expected), 'output contents and key order unchanged');","equalComplete(JSON.stringify(actual), JSON.stringify(expected), 'output contents and key order unchanged');");
 s=r(s,"assert.equal(JSON.stringify(fixture), before, 'live GM/P unchanged by normalization and drafts');","equalComplete(JSON.stringify(fixture), before, 'live GM/P unchanged by normalization and drafts');");
 s=r(s,'    assert.equal(restore(actual), restore(expected));',"    equalComplete(restore(actual), restore(expected), 'complete restored states must match');");
 return s;
});
