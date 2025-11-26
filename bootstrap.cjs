#!/usr/bin/env node

// CommonJS bootstrap that loads your ESM code in src/

const path = require("path");
const { pathToFileURL } = require("url");
const dotenv = require("dotenv");

// Load .env if present
dotenv.config();

// Helper to log fatal errors
function fatal(err) {
  console.error("\n=== TermoSlack crashed ===");
  console.error(err && err.stack ? err.stack : err);
  console.error("==========================\n");
  process.exit(1);
}

(async () => {
  try {
    // Resolve ./src/main.js relative to this file
    const mainPath = path.resolve(__dirname, "src/main.js");
    
    // Convert to file:// URL for Windows compatibility
    const mainURL = pathToFileURL(mainPath).href;

    const mainModule = await import(mainURL);

    // Support different styles:
    //   export default function() {}
    //   export async function start() {}
    if (typeof mainModule.default === "function") {
      await mainModule.default();
    } else if (typeof mainModule.start === "function") {
      await mainModule.start();
    } else {
      console.log(
        "Loaded src/main.js, but no default export or start() function was found."
      );
    }
  } catch (err) {
    fatal(err);
  }
})();
