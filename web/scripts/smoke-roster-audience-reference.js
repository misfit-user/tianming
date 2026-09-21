'use strict';
// Include the shared ESM regression in the full smoke-*.js runner, without duplicating its assertions.
import('./smoke-roster-audience-reference.mjs').catch(error => {
  console.error(error && error.stack || error);
  process.exitCode = 1;
});
