import { edit } from './patch-utils.mjs';
edit('web/tm-storage.js',(s,r)=>r(s,'      try { if (commitObserver) commitObserver(receipt); }',`      try {
        var notification = commitObserver ? commitObserver(receipt) : null;
        if (notification && typeof notification.then === 'function') Promise.resolve(notification).catch(function(error) { try { console.warn('[SaveDB] 异步提交通知失败:', error); } catch (_) {} });
      }`));
edit('web/scripts/verify-all.js',(s,r)=>r(s,"  { name: 'memory-manifest', file: 'smoke-memory-manifest.js', estSec: 1, expectExit: 0 }","  { name: 'save-commit-boundary', file: 'smoke-save-commit-boundary.js', estSec: 3, expectExit: 0 },\n  { name: 'memory-manifest', file: 'smoke-memory-manifest.js', estSec: 1, expectExit: 0 }"));
