// Fixed bundled worker entry: never evaluates task/source strings as code and has no network provider.
'use strict';
importScripts('libs/polygon-clipping-0.15.7.min.js', 'tm-map-workbench.js', 'tm-map-binding-workbench.js');
self.onmessage = function (event) {
  var m = event.data;
  try {
    var result;
    if (m.method === 'inspect') result = TM.MapWorkbench.inspect(m.map, m.options);
    else if (m.method === 'operations') result = TM.MapWorkbench.operations(m.map, m.operations, m.options);
    else if (m.method === 'rebind') result = TM.MapBindingWorkbench.rebind(m.scenario, m.map, m.result, m.options);
    else throw Error('Unknown map worker operation');
    self.postMessage({ requestId: m.requestId, ok: true, result: result });
  } catch (e) {
    self.postMessage({
      requestId: m.requestId,
      ok: false,
      error: { code: e.code || 'geometry-failed', message: e.message, details: e.details || [] },
    });
  }
};
