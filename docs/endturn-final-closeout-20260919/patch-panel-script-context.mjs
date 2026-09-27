import {edit} from './patch-utils.mjs';
for (const file of ['web/scripts/smoke-phase8-map-live-panels.js','web/scripts/smoke-phase8-office-standalone.js']) {
  edit(file, (s,r) => r(s,
    '    vm.runInContext(code, sandbox, { filename: src, displayErrors: true, timeout: 10000 });',
    `    const scriptNode = sandbox.document.createElement('script');
    scriptNode.src = new URL(src, 'http://localhost/index.html').href;
    sandbox.document.currentScript = scriptNode;
    try { vm.runInContext(code, sandbox, { filename: src, displayErrors: true, timeout: 10000 }); }
    finally { sandbox.document.currentScript = null; }`
  ));
}
