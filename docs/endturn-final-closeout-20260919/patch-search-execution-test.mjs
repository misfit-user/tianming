import {edit} from './patch-utils.mjs';
edit('web/scripts/smoke-search-empty-state.js',(s,r)=>{
 const marker="// ── ② 人物名册筛选 ──";
 const code=`// Execute the actual search renderer: both empty states remain visible, and only identical writes are skipped.
{
 const vm=require('vm'),{functionSource}=require('./lib-perf-round1');let value='',writes=0;
 const host={get innerHTML(){return value;},set innerHTML(v){writes++;value=v;}};
 const c={document:{getElementById:()=>host},getMapData:()=>({regions:Array.from({length:8},(_,i)=>({id:'r'+i,name:'河州'+i}))}),regionSearchText:r=>r.name,attr:String,esc:String,ownerName:()=> '测试政权'};
 vm.createContext(c);vm.runInContext(functionSource(mapSrc,'renderMapSearchResults'),c);
 c.renderMapSearchResults('');ok(value.includes('输入地名以检索'),'① 空查询执行后保留提示');
 c.renderMapSearchResults('missing');ok(value.includes('无匹配地块'),'① 未命中执行后保留提示');
 c.renderMapSearchResults('河州');ok((value.match(/<button/g)||[]).length===6,'① 命中列表仍保留六项');
 const before=writes;c.renderMapSearchResults('河州');ok(writes===before,'① 内容一致时不重复写 DOM');
 c.renderMapSearchResults('河州7');ok(value.includes('河州7')&&!value.includes('河州0'),'① 改变查询后实际更新结果');
}

`;
 return r(s,marker,code+marker);
});
