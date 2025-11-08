import { WebClient } from "@slack/web-api";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, "..", ".env") });

console.log("🔑 Token from .env:", process.env.SLACK_BOT_TOKEN ? "Loaded ✅" : "❌ Not loaded");
console.log("Token starts with:", process.env.SLACK_BOT_TOKEN?.slice(0, 6));

const web = new WebClient(process.env.SLACK_BOT_TOKEN);

(async () => {
  try {
    const auth = await web.auth.test();
    console.log("✅ Connected as:", auth.user);
  } catch (err) {
    console.error("❌ Slack error:", err.data?.error || err);
  }
})();