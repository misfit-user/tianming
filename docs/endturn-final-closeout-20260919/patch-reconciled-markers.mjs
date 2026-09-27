import {edit} from './patch-utils.mjs';
edit('web/tm-endturn-render.js',(s,r)=>r(s,"        try { _clearPreEndturnMarkerAfterSave(_endturnSavePreId); } catch (_) {}\n      };\n      var _autoWriteOptions",`        try { _clearPreEndturnMarkerAfterSave(_endturnSavePreId); } catch (_) {}
        try { if (typeof _updateSaveIndex === 'function') _updateSaveIndex(0, _autoMeta); } catch (_) {}
        try { localStorage.setItem('tm_autosave_mark', JSON.stringify({ turn: _autoMeta.turn, timestamp: Date.now(), scenarioName: _autoMeta.scenarioName, eraName: _autoMeta.eraName })); }
        catch (_) { /* The verified canonical slots remain authoritative if a UI marker cannot be persisted. */ }
      };
      var _autoWriteOptions`));
