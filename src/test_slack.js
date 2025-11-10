import { WebClient } from "@slack/web-api";
import dotenv from "dotenv";
dotenv.config({ path: "../.env" });

console.log("BOT TOKEN:", process.env.SLACK_BOT_TOKEN);
console.log("APP TOKEN:", process.env.SLACK_APP_TOKEN);

const web = new WebClient(process.env.SLACK_BOT_TOKEN);

try {
  const auth = await web.auth.test();
  console.log("AUTH OK:", auth);
} catch (err) {
  console.log("AUTH ERROR:", err.data?.error || err.message);
}
