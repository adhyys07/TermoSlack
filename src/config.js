import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Determine env path: next to exe when packaged, otherwise project root
let envPath;
if (process.pkg) {
  envPath = path.join(path.dirname(process.execPath), ".env");
} else {
  envPath = path.join(__dirname, "../.env");
}

console.log("Loading .env from:", envPath);
dotenv.config({ path: envPath });

export const config = {
  botToken: process.env.SLACK_BOT_TOKEN,
  appToken: process.env.SLACK_APP_TOKEN,
  clientId: process.env.SLACK_CLIENT_ID,
  clientSecret: process.env.SLACK_CLIENT_SECRET,
  oauthPort: Number(process.env.OAUTH_PORT || 3000),
};

// simple validation
if (!config.botToken || !config.appToken || !config.clientId || !config.clientSecret) {
  console.warn("⚠️  One or more tokens/credentials are missing in .env. Make sure SLACK_BOT_TOKEN, SLACK_APP_TOKEN, SLACK_CLIENT_ID and SLACK_CLIENT_SECRET are set.");
}
