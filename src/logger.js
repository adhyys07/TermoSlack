import fs from 'fs';
import path from 'path';
import os from 'os';

const APP_DIR = path.join(os.homedir(), '.termoslack');
if (!fs.existsSync(APP_DIR)) {
    try {
        fs.mkdirSync(APP_DIR, { recursive: true });
    } catch (err) {
        console.error('Failed to create app directory:', err);
    }
}

const LOG_FILE = path.join(APP_DIR, 'termoslack.log');

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