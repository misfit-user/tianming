import {edit} from './patch-utils.mjs';
edit('web/tm-save-lifecycle.js',(s,r)=>{
  s=r(s,'var _autoSaveLastSavedTurn=-1;', 'var _autoSaveCommittedRevision=0,_autoSaveLastSavedRevision=-1;\nvar _autoSaveLastSavedTurn=-1;');
  s=r(s,'  lastCommittedSnapshot = ownedState;', '  lastCommittedSnapshot = ownedState;\n  _autoSaveCommittedRevision++;');
  s=r(s,'      && lastCommittedTurn === _autoSaveLastSavedTurn) {','      && lastCommittedTurn === _autoSaveLastSavedTurn && _autoSaveCommittedRevision === _autoSaveLastSavedRevision) {');
  return r(s,'      _autoSaveLastSavedTurn = Number(saveData._saveMeta.turn);','      _autoSaveLastSavedTurn = Number(saveData._saveMeta.turn);\n      _autoSaveLastSavedRevision = _autoSaveCommittedRevision;');
});
