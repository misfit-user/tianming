// feature-manifest.js — declarative runtime feature definitions for TM.Features.
(function (root) {
  'use strict';
  if (!root || !root.TM || !root.TM.Features || typeof root.TM.Features.registerManifest !== 'function') {
    throw new Error('TM.Features must load before feature-manifest.js');
  }

  root.TM.Features.registerManifest({
    version: 1,
    features: {
      reliefGovernance: {
        scripts: ['tm-relief-governance.js?v=20260920-release1352', 'tm-relief-governance-ui.js?v=20260920-release1352'],
        dependsOn: [],
        platform: 'any',
        loadPolicy: 'manual-inspection-only',
        sideEffects: 'none',
        provides: ['TM.ReliefGovernance', 'TM.ReliefGovernanceUI']
      },
      browserTestHarness: {
        scripts: ['tm-test-harness.js?v=20260920-release1352'],
        dependsOn: [],
        platform: 'any',
        loadPolicy: 'query-only',
        sideEffects: 'test-provider',
        provides: ['TM.test']
      },
      desktopUpdate: {
        scripts: [
          'tm-update-card.js?v=20260920-release1352',
          'tm-desktop-update.js?v=20260920-release1352'
        ],
        dependsOn: [],
        platform: 'desktop',
        loadPolicy: 'on-demand',
        sideEffects: 'explicit-lifecycle',
        provides: ['TMUpdateCard', 'TMDesktopUpdate'],
        init: function () { return root.TMDesktopUpdate.init(); },
        dispose: function () { return root.TMDesktopUpdate.dispose(); }
      },
      onlineUpdate: {
        scripts: ['tm-online-update.js?v=20260920-release1352'],
        dependsOn: [],
        platform: 'web',
        loadPolicy: 'idle-after-load',
        sideEffects: 'explicit-lifecycle',
        provides: ['TM_OnlineUpdate'],
        init: function () { return root.TM_OnlineUpdate.init(); },
        dispose: function () { return root.TM_OnlineUpdate.dispose(); }
      },
      formalMapLabels: {
        scripts: [
          'tm-map-label-geo.js?v=20260920-release1352',
          'tm-map-realm-layout.js?v=20260920-release1352',
          'tm-map-label-collide.js?v=20260920-release1352'
        ],
        dependsOn: [],
        platform: 'any',
        loadPolicy: 'first-formal-map-render',
        sideEffects: 'none',
        provides: ['TMMapLabelGeo', 'TMMapRealmLayout', 'TMMapLabelCollide'],
        init: function () {
          var map = root.TMPhase8FormalBridge && root.TMPhase8FormalBridge.map;
          if (map && typeof map.onMapLabelFeatureReady === 'function') map.onMapLabelFeatureReady();
        }
      }
    }
  });
})(typeof window !== 'undefined' ? window : globalThis);
