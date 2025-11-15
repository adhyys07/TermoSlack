import fs from "fs";
import os from "os";
import path from "path";

const APP_DIR = path.join(os.homedir(), ".termoslack");
const SESSIONS_DIR = path.join(APP_DIR, "sessions");

function ensureDirs() {
    if (!fs.existsSync(APP_DIR)) fs.mkdirSync(APP_DIR,{recursive:true});
    if (!fs.existsSync(SESSIONS_DIR)) fs.mkdirSync(SESSIONS_DIR,{recursive:true});
}

export function saveSession(workspaceId, sessionObj) {
    ensureDirs();
    const file = path.join(SESSIONS_DIR, `${workspaceId}.json`);
    fs.writeFileSync(file, JSON.stringify(sessionObj , null , 2 ), {mode: 0o600});
}

export function loadSession(workspaceId) {
    ensureDirs();
    const file= path.join(SESSIONS_DIR, `${workspaceId}.json`);
    if(!fs.existsSync(file)) return null;
    return JSON.parse(fs.readFileSync(file, "utf-8"));
}

export function listSessions() {
    ensureDirs();
    return fs.readdirSync(SESSIONS_DIR)
    .filter(f => f.endsWith(".json"))
    .map(f => f.replace(/\.json$/, ""));
}