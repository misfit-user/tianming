'use strict';
// A feasibility artifact made only from the checked-in/native runtime resources.
// No scenario text is evaluated as code; the iframe retains an opaque origin.
const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto');
const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
function build(root) {
  const web = path.resolve(root, 'web'), source = fs.readFileSync(path.join(web, 'index.html'), 'utf8');
  const nonce = crypto.randomBytes(18).toString('base64');
  const scripts = [], styles = [], files = [];
  function resource(ref) {
    if (!ref || /^(?:[a-z]+:|\/\/)/i.test(ref)) throw Error('preparation requires a local pinned resource: ' + ref);
    const file = path.resolve(web, ref.split(/[?#]/)[0]), relative = path.relative(web, file);
    if (relative.startsWith('..') || path.isAbsolute(relative)) throw Error('resource escaped runtime root');
    const bytes = fs.readFileSync(file); files.push({ file: relative.replace(/\\/g, '/'), bytes: bytes.length, sha256: hash(bytes) });
    return bytes.toString('base64');
  }
  let html = source.replace(/<script\b([^>]*)>([\s\S]*?)<\/script\s*>/gi, (_whole, attrs, body) => {
    const src = /\bsrc\s*=\s*['"]([^'"]+)['"]/i.exec(attrs), type = /\btype\s*=\s*['"]([^'"]+)['"]/i.exec(attrs);
    if (type && !['text/javascript', 'application/javascript'].includes(type[1])) throw Error('unsupported runtime script type: ' + type[1]);
    scripts.push({ name: src ? src[1].split('?')[0] : 'index-inline-' + scripts.length, bytes: src ? resource(src[1]) : Buffer.from(body, 'utf8').toString('base64') });
    return '';
  });
  html = html.replace(/<link\b[^>]*>/gi, whole => {
    if (!/\brel\s*=\s*['"]stylesheet['"]/i.test(whole)) return whole;
    const match = /\bhref\s*=\s*['"]([^'"]+)['"]/i.exec(whole);
    if (!match) throw Error('stylesheet has no source');
    styles.push(resource(match[1])); return '';
  });
  const bootstrap = `(function(){'use strict';
    var state=window.__tmNativePreparationProbe={errors:[],loaded:0,ready:false,storage:'volatile-only'};
    addEventListener('error',function(e){if(state.errors.length<100)state.errors.push(String(e.message||e.error).slice(0,512));});
    addEventListener('unhandledrejection',function(e){if(state.errors.length<100)state.errors.push(String(e.reason&&e.reason.message||e.reason).slice(0,512));});
    function volatileStorage(){var rows=Object.create(null);return{getItem:function(k){return Object.prototype.hasOwnProperty.call(rows,k)?rows[k]:null;},setItem:function(k,v){rows[String(k)]=String(v);},removeItem:function(k){delete rows[String(k)];},clear:function(){rows=Object.create(null);},key:function(i){return Object.keys(rows)[i]||null;},get length(){return Object.keys(rows).length;}};}
    Object.defineProperty(window,'localStorage',{value:volatileStorage(),configurable:false});
    Object.defineProperty(window,'sessionStorage',{value:volatileStorage(),configurable:false});
    Object.defineProperty(window,'indexedDB',{value:undefined,configurable:false});
    function decode(text){return new TextDecoder().decode(Uint8Array.from(atob(text),function(c){return c.charCodeAt(0);}));}
    ${JSON.stringify(styles)}.forEach(function(text){var style=document.createElement('style');style.textContent=decode(text);document.head.appendChild(style);});
    ${JSON.stringify(scripts)}.forEach(function(row){var script=document.createElement('script');script.nonce=${JSON.stringify(nonce)};script.textContent=decode(row.bytes)+'\\n//# sourceURL=native-builtin/'+row.name;document.head.appendChild(script);state.loaded++;});
    addEventListener('DOMContentLoaded',function(){state.ready=true;});
  })();`;
  // This second policy only tightens the production policy. No same-origin, eval,
  // network, worker or filesystem privileges are added to the child.
  html = html.replace(/<head\b[^>]*>/i, whole => whole + '<meta http-equiv="Content-Security-Policy" content="default-src \'none\'; script-src \'nonce-' + nonce + '\'; style-src \'unsafe-inline\'; img-src data: blob:; font-src data:; connect-src \'none\'; worker-src \'none\'; media-src \'none\'; object-src \'none\'; form-action \'none\'">');
  html = html.replace(/<\/body\s*>/i, '<script nonce="' + nonce + '">' + bootstrap + '</script></body>');
  return { html, inputs: files, originalIndexHash: hash(Buffer.from(source)), scriptCount: scripts.length, styleCount: styles.length };
}
module.exports = { build };
