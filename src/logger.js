import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const LOG_FILE = path.join(__dirname, '..', 'termoslack.log');

function formatTimestamp() {
    return new Date().toISOString();
}

function writeLog(level, message, error = null) {
    const timestamp = formatTimestamp();
    let logMessage = `[${timestamp}] [${level}] ${message}`;
    if (error) {
        logMessage += `\n  Error: ${error.message}`;
        if (error.stack) {
            logMessage += `\n  Stack: ${error.stack}`;
        }
    }
    logMessage += '\n';

    try {
        fs.appendFileSync(LOG_FILE, logMessage);
    } catch (err) {
        console.error('Failed to write to log file:', err);
    }
}

export function logInfo(message) {
  writeLog('INFO', message);
}

export function logWarn(message) {
  writeLog('WARN', message);
}

export function logError(message, error = null) {
  writeLog('ERROR', message, error);
}

export function logFatal(message, error = null) {
  writeLog('FATAL', message, error);
}

process.on('uncaughtException', (error) => {
  logFatal('Uncaught exception', error);
  console.error('Fatal error:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  logFatal('Unhandled promise rejection', reason);
  console.error('Unhandled rejection:', reason);
});