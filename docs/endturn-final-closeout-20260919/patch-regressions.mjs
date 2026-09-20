import {edit} from './patch-utils.mjs';
edit('web/scripts/lib-perf-round1.js',(s,r)=>r(s,'Blob, Response, ReadableStream, CompressionStream','Blob, Response, ReadableStream, AbortController, CompressionStream'));
edit('web/scripts/smoke-memory-turn-output-contract.js',(s,r)=>{
 const line=s.split('\n').find(l=>l.startsWith("assert(endturnSource.includes('character_memory_updates: { type:')"));if(!line)throw Error('Schema assertion not found');
 return r(s,line,"const strictSchemaSource = fs.readFileSync(path.join(ROOT, 'tm-endturn-ai-sc1-budget.js'), 'utf8');\nassert(strictSchemaSource.includes('character_memory_updates: { type:') && endturnSource.includes('var _buildSc1JsonSchema = ns._buildSc1JsonSchema;'), 'unchanged strict memory schema has one provider and remains wired into SC1');");
});
edit('web/tm-save-lifecycle.js',(s,r)=>r(s,"  if (options.map !== false) {\n    run('runtime map rebind'","  if (options.map !== false && targetGM._useAIGeo !== true) {\n    run('runtime map rebind'"));
edit('web/phase8-formal-map-dossier.js',(s,r)=>{
 s=r(s,"    var damaged = bld.status === 'damaged';   // S6·半损态","    var damaged = bld.status === 'damaged';   // S6·半损态\n    var moneyUnit = '两';\n    try { if (window.CurrencyUnit && CurrencyUnit.getUnit) moneyUnit = CurrencyUnit.getUnit().money || moneyUnit; } catch (_) {}");
 s=r(s,"'养护用钱： ' + esc(ledger.upkeep) + '（本期，地方支给）</div>'","'养护用钱：地方库款 ' + esc(ledger.upkeep) + ' ' + esc(moneyUnit) + '/回合</div>'");
 s=r(s,"+ esc(ledger.repairCost) + ' 两（造价 30%，至少 20 两）则自动葺治复完。</div>'","+ esc(ledger.repairCost) + ' ' + esc(moneyUnit) + '（造价 30%，至少 20 ' + esc(moneyUnit) + '）则自动葺治复完。</div>'");
 return r(s,'失修停用，候地方修缮后再启。','失修停用，工成之利暂停，候地方修缮后再启。');
});
