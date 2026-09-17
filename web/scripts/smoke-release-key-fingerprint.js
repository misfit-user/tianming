'use strict';
const fs=require('fs'),path=require('path'),crypto=require('crypto'),assert=require('assert'),acorn=require('acorn'),vm=require('vm');
const src=fs.readFileSync(path.join(__dirname,'../tools/build-hot-update-package.js'),'utf8');
const ast=acorn.parse(src,{ecmaVersion:'latest'});
const names=['sha256Buffer','publicKeyFingerprint','authenticateReleaseDocument'];
const code=names.map(name=>{const n=ast.body.find(n=>n.type==='FunctionDeclaration'&&n.id.name===name);assert(n);return src.slice(n.start,n.end);}).join('\n');
const keys=crypto.generateKeyPairSync('ed25519'),other=crypto.generateKeyPairSync('ed25519');
let configured=keys.publicKey.export({type:'spki',format:'pem'});
const c={crypto,path,os:{homedir:()=>'/synthetic-signing-fixture'},process:{env:{}},APP_ROOT:'/synthetic-app',Buffer,
 flag:()=>false,arg:(_key,fallback)=>fallback,
 fs:{existsSync:()=>true,readFileSync:p=>p.includes('private.pem')?keys.privateKey.export({type:'pkcs8',format:'pem'}):configured}};
vm.createContext(c);vm.runInContext(code,c);
const keyId=c.publicKeyFingerprint(keys.publicKey);
assert.equal(keyId,c.publicKeyFingerprint(configured));
assert.equal(keyId,c.publicKeyFingerprint(keys.privateKey));
assert.notEqual(keyId,c.publicKeyFingerprint(other.publicKey));
const signed=c.authenticateReleaseDocument({version:'fixture',note:'仅内存临时测试密钥'});
assert.equal(signed.auth.keyId,keyId);
assert(crypto.verify(null,Buffer.from(signed.auth.payload,'base64'),keys.publicKey,Buffer.from(signed.auth.signature,'base64')));
configured=other.publicKey.export({type:'spki',format:'pem'});
assert.throws(()=>c.authenticateReleaseDocument({version:'fixture'}),/公钥不匹配/);
console.log('PASS release key fingerprint: KeyObject/PEM/private, signed roundtrip, mismatched-key rejection; no release or owner key access');
