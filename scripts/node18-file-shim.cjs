// vsce 2.x (undici) necesita el global File, que Node 18.13 no expone (sí en Node 20+).
if (typeof globalThis.File === 'undefined') {
  globalThis.File = require('buffer').File;
}
