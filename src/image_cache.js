import terminalImage from "terminal-image";
import fetch from "node-fetch";
import fs from "fs";
import path from "path";
import crypto from "crypto";
import { fileURLToPath } from "url";
import { logInfo, logError } from "./logger.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const CACHE_DIR = path.join(__dirname, "..", ".image-cache");

if (!fs.existsSync(CACHE_DIR)) {
    fs.mkdirSync(CACHE_DIR, { recursive: true });
    logInfo(`Created image cache directory `);
}

export async function getCachedImage(url, token, options = {}) {
    try{
        const hash = crypto.createHash("md5").update(url).digest("hex");
        const cachePath = path.join(CACHE_DIR, hash);

        if (fs.existsSync(cachePath)) {
            logInfo(`Loading image from cache: ${hash}`);
            const cachedBuffer = fs.readFileSync(cachePath);
            return await terminalImage.buffer(cachedBuffer,{
                width: options.width || '90%',
                height: options.height || '90%',
                preserveAspectRatio: true
            });
    }
    logInfo("Downloading image: " + url);
    const response = await fetch(url,{
        headers: { 'Authorization': `Bearer ${token}` }
    });
    if (!response.ok) {
        throw new Error(`Failed to fetch image: ${response.statusText}`);
    }
    const buffer = await response.buffer();

    fs.writeFileSync(cachePath, buffer);
    logInfo(`Cached image to: ${hash}`);

    return await terminalImage.buffer(buffer,{
        width: options.width || '90%',
        height: options.height || '90%',
        preserveAspectRatio: true
    });
    } catch (error) {
        logError("Error in getCachedImage:", error);
        return '[❌ Image failed - Terminal quality limited. Press O to open in browser]'
    }
}

export async function clearImageCache() {
    try{
        if (fs.existsSync(CACHE_DIR)) {
            const files = fs.readdirSync(CACHE_DIR);
            files.forEach(file => {
                fs.unlinkSync(path.join(CACHE_DIR, file));
            });
            logInfo("Cleared image cache");
        }
    } catch (error) {
        logError("Error clearing image cache:", error);
    }
}

export async function getImageThumbnail(url, token) {
    return await getCachedImage(url, token, {
        width: 20,
        height: 10
    });
}