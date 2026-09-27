import { edit } from './patch-utils.mjs';
edit('web/scripts/verify-all.js', (s, r) => r(s,
  "  { name: 'memory-manifest', file: 'smoke-memory-manifest.js', estSec: 1, expectExit: 0 }",
  "  { name: 'memory-boundary-upgrade', file: 'smoke-memory-boundary-upgrade.js', estSec: 3, expectExit: 0 },\n  { name: 'memory-manifest', file: 'smoke-memory-manifest.js', estSec: 1, expectExit: 0 }"
));
