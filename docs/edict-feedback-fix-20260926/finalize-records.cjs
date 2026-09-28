'use strict';const {edit,replace:R}=require('./edit.cjs');
edit('web/tm-endturn-render.js',s=>R(s,"  var shijiHtml = (typeof _composeShijiHtml === 'function')", "  if (TM.EdictOutcomes) TM.EdictOutcomes.finalizeTurn(GM,GM.turn-1);\n  var shijiHtml = (typeof _composeShijiHtml === 'function')"));
