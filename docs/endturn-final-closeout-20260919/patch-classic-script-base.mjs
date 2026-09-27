import {edit} from './patch-utils.mjs';
edit('web/scripts/headless-smoke.js',(s,r)=>r(s,"  doc.readyState = 'complete';",`  doc.readyState = 'complete';
  doc.baseURI = 'http://localhost/index.html';
  // Legacy root-script loaders need the same URL base as a browser classic script.
  // Per-file loaders replace this with the exact element before executing each source.
  doc.currentScript = makeNode('script');
  doc.currentScript.src = 'http://localhost/headless-classic-script.js';`));
