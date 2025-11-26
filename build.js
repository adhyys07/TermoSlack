import caxa from "caxa";
import path from "path";
import os from "os";
import fs from "fs";

// Set custom temp directory for caxa build
const customTemp = path.join('E:', 'kooda');
if (!fs.existsSync(customTemp)) {
  fs.mkdirSync(customTemp, { recursive: true });
}
process.env.TEMP = customTemp;
process.env.TMP = customTemp;
process.env.TMPDIR = customTemp;

await caxa({
  // Package the whole project directory
  input: ".",
  output: "TermoSlack.exe",
  command: [
    "{{caxa}}/node_modules/.bin/node",
    "{{caxa}}/bootstrap.cjs"
  ],

  // Optional: don't bloat the exe with build artifacts/logs
  exclude: [
    "dist",
    "*.log",
    "ngrok.exe",
    ".image-cache",
    ".sessions",
    ".git",
    ".gitignore",
    "README.md",
    "build.js",
    "TermoSlack.exe",
    "node_modules/.cache",
    "node_modules/**/*.md",
    "node_modules/**/*.ts",
    "node_modules/**/test",
    "node_modules/**/tests",
    "node_modules/**/.bin",
    "node_modules/**/docs",
    "node_modules/**/examples",
    "node_modules/**/*.map"
  ]
});

console.log('\n✅ Build complete! TermoSlack.exe created.');
console.log('💡 Tip: Build temp files are in E:\\kooda\n');
