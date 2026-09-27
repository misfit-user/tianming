import fs from 'node:fs';import assert from 'node:assert/strict';
const file='docs/map-deep-zoom-20260918/verify-zoom-ui.mjs';let t=fs.readFileSync(file,'utf8');
const needle=' // Real wheel input at the target must preserve its screen anchor while reducing deep zoom.';assert.equal(t.split(needle).length,2);
const extra=` if(mode==='cross-scenario'){
  await js(\`document.querySelector('[data-map-reset]').click()\`);await sleep(500);
  const reset=await js(\`({view:TMPhase8FormalBridge.__p8MapParts.state.mapView,rendering:document.getElementById('tmf-formal-map').dataset.zoomRendering,paths:document.querySelectorAll('#tmf-formal-map .tmf-region').length})\`);
  check('cross-scenario-reset',reset.view.scale===1&&reset.view.tx===0&&reset.view.ty===0&&reset.paths===source.regions&&reset.rendering==='compositor',reset);
  report.resetScreenshot=await shot('whole-map-after-deep-zoom');report.complete=true;finish(0);return;
 }
`;
fs.writeFileSync(file,t.replace(needle,extra+needle));console.log('Other scenarios exercise startup, 128x, real target click and reset without repeating the full touch sequence.');
