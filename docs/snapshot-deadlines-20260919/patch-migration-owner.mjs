import { edit } from './patch-utils.mjs';
edit('web/tm-state-snapshot.js',(s,r)=>r(s,'              if (settled || _openOwner !== owner) return;','              if (_openOwner !== owner) return;'));
