'use strict';

// The preload bridge is part of the signed application shell. Content OTA may
// replace renderer assets only; it cannot replace or extend this trust boundary.
require('./preload-impl.js');
