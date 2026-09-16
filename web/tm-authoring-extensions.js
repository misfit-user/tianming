// Explicit optional capability boundary shared by old/new editors. No project database is loaded here.
(function (root) {
  'use strict';
  var workbench = null;
  root.TM = root.TM || {};
  root.TM.AuthoringExtensions = {
    registerWorkbench: function (api) {
      if (workbench && workbench !== api) throw Error('Workbench provider already registered');
      if (!api || !Array.isArray(api.specs) || typeof api.dispatch !== 'function')
        throw Error('Invalid workbench capability');
      workbench = api;
    },
    getWorkbench: function () {
      return workbench;
    },
  };
})(typeof window !== 'undefined' ? window : globalThis);
