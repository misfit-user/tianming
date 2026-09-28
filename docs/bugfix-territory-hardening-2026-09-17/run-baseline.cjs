'use strict';
// Test-only read overlay. It never restores or rewrites the working tree.
const fs=require('fs'),path=require('path'),Module=require('module');
const repo=path.resolve(__dirname,'../..'),web=path.join(repo,'web');
const read=fs.readFileSync;
fs.readFileSync=function(file,...args){
  if(typeof file==='string'){
    const full=path.resolve(file),relative=path.relative(web,full);
    if(!relative.startsWith('..')&&!path.isAbsolute(relative)){
      const original=path.join(__dirname,'originals',relative);
      if(fs.existsSync(original))return read.call(fs,original,...args);
    }
  }
  return read.call(fs,file,...args);
};
Module.syncBuiltinESMExports();
const name=process.argv[2];
if(!/^smoke-[a-z0-9-]+\.js$/.test(name || ''))throw Error('test name required');
console.log('BASELINE_READ_OVERLAY '+name);
require(path.join(web,'scripts',name));
