const { copyFileSync, mkdirSync } = require('fs');
const { dirname } = require('path');

try {
  const src = require.resolve('fuse.js/dist/fuse.esm.js');
  const dest = 'public/web_modules/fuse.js';
  mkdirSync(dirname(dest), { recursive: true });
  copyFileSync(src, dest);
  console.log('Copied Fuse.js to public/web_modules/fuse.js');
} catch (e) {
  console.warn('Fuse copy skipped:', e.message);
}
