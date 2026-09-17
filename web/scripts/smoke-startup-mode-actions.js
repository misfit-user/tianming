'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {functionSource}=require('./lib-perf-round1'),arg=process.argv.indexOf('--repo'),root=arg<0?path.resolve(__dirname,'../..'):path.resolve(process.argv[arg+1]);
const source=fs.readFileSync(path.join(root,'web/tm-electron.js'),'utf8');
const start=source.indexOf('window.desktopConfirmStart=function'),end=source.indexOf('window.desktopDoStart=function',start);assert(start>=0&&end>start);
const code=['_desktopElement','_desktopButton','_desktopPanel','_desktopFooter'].map(n=>functionSource(source,n)).join('\n')+'\n'+source.slice(start,end);
let checks=0;
for(const long of [false,true]){
  const nodes=[];let panel=null,started=0,returned=0;
  function element(tag){const e={tagName:tag.toUpperCase(),style:{},children:[],events:{},className:'',appendChild(n){this.children.push(n);return n;},addEventListener(k,fn){this.events[k]=fn;}};e.classList={add(n){e.className+=' '+n;}};Object.defineProperty(e,'firstElementChild',{get(){return e.children[0];}});nodes.push(e);return e;}
  const input=element('input');input.id='start-save-name';input.value=long?'晚唐·开成五年——山海诸邦：保留完整说明与长存档名':'正常剧本';
  const c=vm.createContext({document:{createElement:element},_pendingStartPayload:{scn:{id:'fixture',worldSettings:{historicalOutcomePolicy:long?'player-driven':'fixed'}}},_$:id=>nodes.find(n=>n.id===id),showPanel:p=>panel=p,toast(){},desktopDoStart(){started++;},desktopBackToStartPanel(){returned++;},TM:{HistoricalAgency:{isPlayerDriven:()=>long,modeDescription:()=>('历史与制度为依据，玩家决定后续发展。'.repeat(40))}}});c.window=c;vm.runInContext(code,c);c.desktopConfirmStart();
  assert(panel&&panel.className.includes('pnl-mode-setup'));assert(panel.style.cssText.includes('height:80vh')&&panel.style.cssText.includes('flex-direction:column'));assert.equal(panel.firstElementChild.style.flex,'0 0 auto');
  const body=nodes.find(n=>n.className==='pnl-mode-body'),footer=panel.children[panel.children.length-1],button=nodes.find(n=>n.id==='start-mode-btn');assert(body.style.cssText.includes('overflow-y:auto')&&body.style.cssText.includes('min-height:0'));assert(footer.style.cssText.includes('flex:0 0 auto'));assert(footer.children.includes(button)&&footer.children.length===2);checks+=3;
  for(const [id,mode] of [['mo-yanyi','yanyi'],['mo-light','light_hist'],['mo-strict','strict_hist']]){nodes.find(n=>n.id===id).events.click();assert.equal(c._pendingStartMode,mode);assert.equal(nodes.find(n=>n.id==='strict-mode-options').style.display,mode==='strict_hist'?'block':'none');checks++;}
  button.events.click();footer.children[1].events.click();assert.equal(started,1);assert.equal(returned,1);assert.equal(c._pendingStartPayload.saveName,input.value);checks++;
}
console.log('PASS '+checks+' actual startup mode layout and action contracts');
