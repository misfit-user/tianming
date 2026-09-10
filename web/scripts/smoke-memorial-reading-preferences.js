'use strict';
const assert = require('assert/strict'), fs = require('fs'), path = require('path'), vm = require('vm');
const source = fs.readFileSync(path.join(__dirname, '../tm-theme-font.js'), 'utf8');
function load(saved = {}, failStorage = false) {
  const styles = new Map(), store = new Map(Object.entries(saved));
  const context = { console, document: { readyState:'loading', addEventListener(){},
    getElementById:id=>styles.get(id), createElement:()=>({textContent:''}), head:{appendChild:s=>styles.set(s.id,s)} },
    localStorage:{getItem:key=>{if(failStorage)throw Error('storage denied');return store.get(key)??null;},setItem:(key,value)=>{if(failStorage)throw Error('quota');store.set(key,String(value));}} };
  context.window=context;vm.runInNewContext(source,context,{filename:'tm-theme-font.js'});
  return { api:context.TMThemeFont, styles, store };
}
let pass=0;
function test(name,fn){fn();pass++;console.log('PASS '+name);}
test('global/scoped factors are independently written; legacy targets retained',()=>{
  const r=load();r.api.applySize('xl',null,true);r.api.applyScopeSize('memorial','lg');
  assert(r.styles.get('_tmSizeOverride').textContent.includes('--tm-font-global-scale:1.3;'));
  const scoped=r.styles.get('_tmScopedSizeOverride').textContent;
  assert(scoped.includes('.zou-yuan{--tm-size-memorial:1.14;}'));assert(scoped.includes('.mem-panel'));
  r.api.applyScopeSize('memorial','md');assert.equal(r.styles.get('_tmScopedSizeOverride').textContent,'');
});
test('three bounded ink presets update only memorial CSS and persist',()=>{
  const r=load();for(const [key,color] of [['ink','#241d15'],['black','#181818'],['indigo','#263e50']]){
    r.api.applyMemorialInk(key,true);assert.equal(r.store.get('tm.memorialInk'),key);
    assert(r.styles.get('_tmMemorialInkOverride').textContent.includes('--tm-memorial-ink:'+color+';'));
  }
  assert.equal(r.styles.size,1);
});
test('restore consumes persisted size and ink through the actual APIs',()=>{
  const r=load({'tm.fontSize':'lg','tm.fontSizeScopes':'{"memorial":"xl"}','tm.memorialInk':'indigo'});r.api.restore();
  assert(r.styles.get('_tmSizeOverride').textContent.includes('--tm-font-global-scale:1.14;'));
  assert(r.styles.get('_tmScopedSizeOverride').textContent.includes('.zou-yuan{--tm-size-memorial:1.3;}'));
  assert(r.styles.get('_tmMemorialInkOverride').textContent.includes('#263e50'));
});
test('invalid or hostile preference values fall back without CSS injection',()=>{
  const bad='x;}body{display:none}';const r=load({'tm.memorialInk':bad,'tm.fontSize':bad,'tm.fontSizeScopes':'{"memorial":"bad"}'});r.api.restore();
  assert.equal(r.store.get('tm.memorialInk'),'ink');
  for(const st of r.styles.values())assert(!st.textContent.includes('display:none'));
});
test('storage denial does not prevent safe in-memory reading settings',()=>{
  const r=load({},true);r.api.restore();r.api.applyMemorialInk('black',true);r.api.applyScopeSize('memorial','xl');
  assert(r.styles.get('_tmMemorialInkOverride').textContent.includes('#181818'));
});
test('existing shared settings renderer exposes exactly one selected color control',()=>{
  const r=load({'tm.memorialInk':'indigo'});const html=r.api.renderControls();
  assert.equal((html.match(/data-memorial-ink/g)||[]).length,1);
  assert(html.includes('value="indigo" selected'));assert(html.includes('奏疏文字颜色'));
});
console.log(JSON.stringify({PASS:pass,FAIL:0,SKIP:0,WAIVED:0}));
