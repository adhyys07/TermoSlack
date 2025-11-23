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
  clientId: process.env.SLACK_CLIENT_ID,
  clientSecret: process.env.SLACK_CLIENT_SECRET,
  oauthPort: Number(process.env.OAUTH_PORT || 3000),
  redirectUri: process.env.OAUTH_REDIRECT_URI,
  userScopes: process.env.OAUTH_USER_SCOPES || "channels:read,channels:write,channels:history,chat:write,users:read,groups:read,groups:write,groups:history,mpim:read,mpim:write,mpim:history,im:read,im:write,im:history,files:read,files:write,reactions:read,reactions:write,search:read,emoji:read"
};

// simple validation
if (!config.clientId || !config.clientSecret) {
  console.warn("⚠️  OAuth credentials are missing in .env. Make sure SLACK_CLIENT_ID and SLACK_CLIENT_SECRET are set.");
}
