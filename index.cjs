#!/usr/bin/env node
// Alternative entry point using CommonJS for pkg compatibility
// This wraps the ESM modules for the packaged executable

const path = require('path');
const { pathToFileURL } = require('url');

(async () => {
  try {
    // Determine the correct path for the main.js file
    const mainPath = process.pkg 
      ? path.join(path.dirname(process.execPath), 'src', 'main.js')
      : path.join(__dirname, 'src', 'main.js');
    
    // Convert to file URL and import
    const mainUrl = pathToFileURL(mainPath).href;
    await import(mainUrl);
  } catch (err) {
    console.error('Failed to start application:', err);
    console.error(err.stack);
    process.exit(1);
  }
})();
