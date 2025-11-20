#!/usr/bin/env node
// Bootstrap (CommonJS) for pkg: dynamically import the ESM entry (src/main.js)
// This avoids "Cannot use import statement outside a module" errors when running
// from the packaged binary.

const path = require('path');

(async () => {
  try {
    const entryPath = path.join(__dirname, 'src', 'main.js');
    const fileUrl = 'file://' + entryPath.replace(/\\/g, '/');
    await import(fileUrl);
  } catch (err) {
    console.error('Failed to load ESM entry:', err);
    process.exit(1);
  }
})();
