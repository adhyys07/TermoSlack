import dotenv from "dotenv";
import {dirname, join} from "url";
import { fileURLToPath } from "url";
const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, "../.env") });

export const config = {
    token : env.SLACK_BOT_TOKEN,
};

if (!config.token) {
    console.error("MISSING SLACK_BOT_TOKEN in your .env. Add it to proceed further")
    process.exit(1);
}