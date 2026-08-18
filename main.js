'use strict';

// The Electron main process is executable application code. It is updated only
// by a signed installer and must never be loaded from the renderer content-OTA
// cache.
require('./main-impl.js');
