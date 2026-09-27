import {edit} from './patch-utils.mjs';
edit('web/scripts/smoke-perf-save-preparation.js',(s,r)=>{
 s=r(s,"require('v8').setFlagsFromString('--expose_gc');\nconst collectComparisonGarbage = require('vm').runInNewContext('gc');","const collectComparisonGarbage = typeof global.gc === 'function' ? global.gc : function() {};");
 s=r(s,"[__filename, '--repo', root, '--case', String(i)]","['--expose-gc', __filename, '--repo', root, '--case', String(i)]");
 s=r(s,"      const expected = h.legacyBuild(format), actual = h.c._buildSaveState({ format, detach: true });\n      equalComplete(JSON.stringify(actual), JSON.stringify(expected), 'output contents and key order unchanged');",`      let expectedText = JSON.stringify(h.legacyBuild(format));
      collectComparisonGarbage();
      const actual = h.c._buildSaveState({ format, detach: true });
      equalComplete(JSON.stringify(actual), expectedText, 'output contents and key order unchanged');
      expectedText = null;`);
 s=r(s,"    const actual = h.c._buildSaveState({ format: 'idb', detach: true }), expected = h.legacyBuild('idb');\n    function restore(value)","    function restore(value)");
 s=r(s,"    equalComplete(restore(actual), restore(expected), 'complete restored states must match');",`    let restoredExpected = restore(h.legacyBuild('idb'));
    collectComparisonGarbage();
    equalComplete(restore(h.c._buildSaveState({ format: 'idb', detach: true })), restoredExpected, 'complete restored states must match');
    restoredExpected = null; collectComparisonGarbage();`);
 return s;
});
