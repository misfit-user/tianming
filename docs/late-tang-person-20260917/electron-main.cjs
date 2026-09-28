'use strict';
// Reuse the repository's production main/preload acceptance bridge in a disposable profile.
const path=require('path'),fs=require('fs'),Module=require('module');
const root=path.resolve(__dirname,'../..');
process.env.TM_BRIDGE_TEST_ROOT=root;
process.env.TM_BRIDGE_TEST_MODE='character-actions';
process.env.TM_BRIDGE_TEST_REPORT=path.join(__dirname,'electron-report.json');
process.env.TM_BRIDGE_TEST_USERDATA=path.join(__dirname,'isolated-userdata-'+Date.now());
fs.mkdirSync(process.env.TM_BRIDGE_TEST_USERDATA,{recursive:false});
const loader=Module._load;
Module._load=function(request,parent,...args){
  if(request==='./character-actions-cases.cjs'&&parent&&parent.filename===path.join(root,'scripts/electron/bridge-main.cjs'))return loader.call(this,path.join(__dirname,'electron-cases.cjs'),parent,...args);
  return loader.call(this,request,parent,...args);
};
require(path.join(root,'scripts/electron/bridge-main.cjs'));
