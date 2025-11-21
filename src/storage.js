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
    // normalize token keys so older session formats still include userToken
    const normalized = Object.assign({}, sessionObj);
    normalized.userToken = normalized.userToken || normalized.access_token || normalized.token || (normalized.authed_user && normalized.authed_user.access_token) || normalized.user_token || null;
    try {
        fs.writeFileSync(file, JSON.stringify(normalized , null , 2 ), {mode: 0o600});
        // log path for debugging
        try { console.log(`Saved session for ${workspaceId} -> ${file}`); } catch (e) {}
    } catch (e) {
        // fallback without mode (Windows)
        fs.writeFileSync(file, JSON.stringify(normalized , null , 2 ));
        try { console.log(`Saved session for ${workspaceId} -> ${file}`); } catch (e) {}
    }
}

export function loadSession(workspaceId) {
    ensureDirs();
    const file= path.join(SESSIONS_DIR, `${workspaceId}.json`);
    if(!fs.existsSync(file)) return null;
    try {
        const raw = JSON.parse(fs.readFileSync(file, "utf-8"));
        // normalize possible token field names to `userToken`
        const normalized = Object.assign({}, raw);
        normalized.userToken = normalized.userToken || normalized.access_token || normalized.token || (normalized.authed_user && normalized.authed_user.access_token) || normalized.user_token || null;
        return normalized;
    } catch (e) {
        return null;
    }
}

export function listSessions() {
    ensureDirs();
    return fs.readdirSync(SESSIONS_DIR)
    .filter(f => f.endsWith(".json"))
    .map(f => f.replace(/\.json$/, ""));
}