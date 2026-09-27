// Restore the original B5 data notices. No executable code is downloaded or run.
import fs from 'node:fs';import path from 'node:path';import crypto from 'node:crypto';
const dest=path.resolve(import.meta.dirname,'../../web/vendor/shanhe25d/licenses');
const expected={'COPYING':'fce02ebb691c768cde194afbe91b8025fd7b1f49031f33996deb246a5926f0e2','COPYING.LESSER':'473c6d57b306d336c5e9d0ef42c699d4e2ac1d9ec24727882de9e3508a25e6bb','LICENSE.mit':'c2b3d5f8d1a092d1a288186741251b066f9148e68bbf8c01680a84f487cb30b1','LICENSE.epsg':'64ffa59798273002fde4a1416fc8ddaf7325fb8806dd9351c6a7bfbf7a49782f'};
fs.mkdirSync(dest,{recursive:true});
for(const [name,sha]of Object.entries(expected)){
 const response=await fetch('https://raw.githubusercontent.com/matplotlib/basemap/v2.0.0/data/basemap_data/'+name,{signal:AbortSignal.timeout(12000)});
 if(!response.ok)throw Error('Licence request failed: '+name+' '+response.status);
 const text=await response.text(),actual=crypto.createHash('sha256').update(text).digest('hex');
 if(actual!==sha)throw Error('Licence content differs from approved B5: '+name+' '+actual);
 fs.writeFileSync(path.join(dest,name),text);console.log('Restored original notice: '+name);
}
