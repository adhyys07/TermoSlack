#!/usr/bin/env node
// Bootstrap (CommonJS) for pkg: dynamically import the ESM entry (src/main.js)
// This avoids "Cannot use import statement outside a module" errors when running
// from the packaged binary.

const path = require('path');
const { pathToFileURL } = require('url');

(async () => {
  try {
    let entryPath;
    if (process.pkg) {
      // Running in packaged executable - use snapshot path
      entryPath = path.join(__dirname, 'src', 'main.js');
    } else {
      // Running with node - use file URL
      entryPath = path.join(__dirname, 'src', 'main.js');
    }
    // Convert Windows path to proper file:// URL
    const fileUrl = pathToFileURL(entryPath).href;
    await import(fileUrl);
  } catch (err) {
    console.error('Failed to load ESM entry:', err);
    process.exit(1);
  }
})();
