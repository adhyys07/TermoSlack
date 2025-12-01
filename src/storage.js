import fs from "fs";
import os from "os";
import path from "path";

const APP_DIR = path.join(os.homedir(), ".termoslack");
const SESSIONS_DIR = path.join(APP_DIR, "sessions");

function ensureDirs() {
    if (!fs.existsSync(APP_DIR)) fs.mkdirSync(APP_DIR,{recursive:true});
    if (!fs.existsSync(SESSIONS_DIR)) fs.mkdirSync(SESSIONS_DIR,{recursive:true});
}

export function saveSession(workspaceId, userId, sessionObj) {
    ensureDirs();
    // Save per user so multiple users can use the app
    const file = path.join(SESSIONS_DIR, `${workspaceId}_${userId}.json`);
    // normalize token keys so older session formats still include userToken
    const normalized = Object.assign({}, sessionObj);
    normalized.userToken = normalized.userToken || normalized.access_token || normalized.token || (normalized.authed_user && normalized.authed_user.access_token) || normalized.user_token || null;
    normalized.userId = userId;
    normalized.createdAt = normalized.createdAt || new Date().toISOString();
    try {
        fs.writeFileSync(file, JSON.stringify(normalized , null , 2 ), {mode: 0o600});
        // log path for debugging
        try { console.log(`Saved session for ${workspaceId}/${userId} -> ${file}`); } catch (e) {}
    } catch (e) {
        // fallback without mode (Windows)
        fs.writeFileSync(file, JSON.stringify(normalized , null , 2 ));
        try { console.log(`Saved session for ${workspaceId}/${userId} -> ${file}`); } catch (e) {}
    }
}

export function loadSession(workspaceId, userId) {
    ensureDirs();
    const file= path.join(SESSIONS_DIR, `${workspaceId}_${userId}.json`);
    if(!fs.existsSync(file)) {
        // Try legacy format (without userId) for backward compatibility
        const legacyFile = path.join(SESSIONS_DIR, `${workspaceId}.json`);
        if (fs.existsSync(legacyFile)) {
            try {
                const raw = JSON.parse(fs.readFileSync(legacyFile, "utf-8"));
                const normalized = Object.assign({}, raw);
                normalized.userToken = normalized.userToken || normalized.access_token || normalized.token || (normalized.authed_user && normalized.authed_user.access_token) || normalized.user_token || null;
                normalized.userId = normalized.userId || userId;
                return normalized;
            } catch (e) {}
        }
        return null;
    }
    try {
        const raw = JSON.parse(fs.readFileSync(file, "utf-8"));
        // normalize possible token field names to `userToken`
        const normalized = Object.assign({}, raw);
        normalized.userToken = normalized.userToken || normalized.access_token || normalized.token || (normalized.authed_user && normalized.authed_user.access_token) || normalized.user_token || null;
        normalized.userId = normalized.userId || userId;
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

export function deleteSession(workspaceId, userId) {
    ensureDirs();
    const file = path.join(SESSIONS_DIR, `${workspaceId}_${userId}.json`);
    if (fs.existsSync(file)) {
        try {
            fs.unlinkSync(file);
            return true;
        } catch (e) {
            console.error(`Failed to delete session: ${e.message}`);
            return false;
        }
    }
    return false;
}