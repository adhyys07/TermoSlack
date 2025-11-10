import dotenv from "dotenv";
import {dirname, join} from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(fileURLToPath(import.meta.url));

dotenv.config({ 
    path: join(__dirname, "../.env"),
 });

export const config = {
    botToken : process.env.SLACK_BOT_TOKEN,
    appToken: process.env.SLACK_APP_TOKEN,
};

if (!config.botToken) {
    console.error("MISSING SLACK_BOT_TOKEN in your .env. Add it to proceed further")
    process.exit(1);
}
