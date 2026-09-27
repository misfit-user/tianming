'use strict';
const assert=require('assert/strict'),fs=require('fs'),path=require('path'),vm=require('vm');
const {userMessage,jsonBlock}=require('./lib-sc1-lossless-fixture');
const tests=[];const test=(name,fn)=>tests.push({name,fn});
const c={TM:{Endturn:{AI:{}}},getPromptBudget:()=>({contextK:8,budget:6144}),console};c.window=c;vm.createContext(c);vm.runInContext(fs.readFileSync(path.join(__dirname,'../tm-endturn-ai-sc1-budget.js'),'utf8'),c);
const api=c.TM.Endturn.AI.subcalls,options={contextTokens:8192,completionTokens:2048};
const body=text=>({model:'fixture',messages:[{role:'system',content:'Complete strict rules; no facts may be omitted.'},{role:'user',content:text}],max_tokens:2048,response_format:{type:'json_schema',json_schema:{name:'sc1',strict:true,schema:{type:'object',properties:{turn_summary:{type:'string'}}}}}});
test('only JSON formatting is compacted and the complete parsed evidence is preserved',()=>{
 const input=body(userMessage()),before=JSON.stringify(input),out=api.finalizeSc1RequestBody(input,options);assert(out.diagnostics.formattingCharsRemoved>0);assert.equal(out.diagnostics.omittedChars,0);assert(!out.diagnostics.trimmed);assert(out.diagnostics.finalTotalTokens<=8192);
 assert.deepEqual(JSON.parse(jsonBlock(out.body.messages[1].content)),JSON.parse(jsonBlock(input.messages[1].content)));assert.equal(JSON.stringify(input),before);assert.equal(out.body.messages[0].content,input.messages[0].content);assert.deepEqual(JSON.parse(JSON.stringify(out.body.response_format)),input.response_format);assert.equal(out.body.max_tokens,2048);
});
test('a unique mid-prompt instruction is never removed to satisfy an impossible window',()=>{
 const text='真实原始事实。'.repeat(5000)+'\nUNIQUE_PLAYER_ORDER_MIDDLE\n'+'完整后续约束。'.repeat(5000),input=body(text),before=JSON.stringify(input);
 assert.throws(()=>api.finalizeSc1RequestBody(input,options),e=>e.code==='mandatory_context_overflow'&&e.preservedAllContent&&e.requiredInputTokens>e.inputTokenLimit);assert.equal(JSON.stringify(input),before);
});
test('strings, long exact numeric digits, escaped quotes and whitespace inside strings are not rewritten',()=>{
 const numeric='9007199254740993123456789',json='{\n'+ ' '.repeat(30000)+'"amount": '+numeric+', "text": "  字符串内空格\\n必须保留\\\"引号", "negativeZero": -0\n}';
 const out=api.finalizeSc1RequestBody(body(json),options).body.messages[1].content;assert(out.includes(numeric));assert(out.includes('"negativeZero":-0'));assert(out.includes('"  字符串内空格\\n必须保留\\\"引号"'));
});
test('fitting prose remains byte-for-byte identical',()=>{const text='  文言正文\n    保留排版、诗句、数字与格式。';const input=body(text),out=api.finalizeSc1RequestBody(input,options);assert.equal(out.body.messages[1].content,text);assert.equal(out.diagnostics.formattingCharsRemoved,0);});
test('non-JSON code fences and malformed blocks cannot be silently pruned',()=>{for(const content of ['```python\n'+'    print("keep")\n'.repeat(3000)+'```','```json\n'+ '{invalid}'.repeat(8000)+'\n```'])assert.throws(()=>api.finalizeSc1RequestBody(body(content),options),e=>e.code==='mandatory_context_overflow');});
test('context retry retains strict schema and all evidence, not a weaker response format',()=>{const input=body(userMessage()),out=api.createSc1ContextOverflowReducer(options)(input);assert.deepEqual(JSON.parse(JSON.stringify(out.response_format)),input.response_format);assert.deepEqual(JSON.parse(jsonBlock(out.messages[1].content)),JSON.parse(jsonBlock(input.messages[1].content)));assert.equal(out.max_tokens,input.max_tokens);});
test('already compact overflow cannot trigger another smaller-but-incomplete request',()=>{const input=api.finalizeSc1RequestBody(body(userMessage()),options).body;assert.throws(()=>api.createSc1ContextOverflowReducer(options)(input),e=>e.code==='mandatory_context_overflow'&&e.preservedAllContent);});
test('unchanged partial fields cannot be reconstructed as a complete request',()=>{const input=body('必须全部保留的系统规则。');input.messages[0].content='不许删除系统规则'.repeat(4000);assert.throws(()=>api.finalizeSc1RequestBody(input,options));assert.equal(input.messages[0].content,'不许删除系统规则'.repeat(4000));});
let pass=0,fail=0;for(const t of tests)try{t.fn();pass++;console.log('PASS '+t.name);}catch(e){fail++;console.error('FAIL '+t.name+'\n'+e.stack);}console.log(JSON.stringify({pass,fail,total:tests.length}));if(fail)process.exitCode=1;
