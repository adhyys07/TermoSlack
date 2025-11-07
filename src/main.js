import { WebClient } from "@slack/web-api";
import { RTMClient } from "@slack/rtm-api";
import readline from "readline";
import chalk from "chalk";
import { env } from "process";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, "..", ".env") });

const token = env.SLACK_TOKEN || env.slack_token;
if (!token) {
  console.error(chalk.red("Missing SLACK_TOKEN environment variable. Set SLACK_TOKEN (or slack_token) before running."));
  process.exit(1);
}
const web = new WebClient(token);
const rtm = new RTMClient(token);

let currentChannel;

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  prompt: chalk.green("You> "),
});

async function listChannels() {
  const res = await web.conversations.list();
  console.log(chalk.yellow("\nChannels:"));
  res.channels.forEach((ch) => console.log(`• ${ch.name} (${ch.id})`));
}

async function sendMessage(text) {
  if (!currentChannel) {
    console.log(chalk.red("No channel selected. Use /join <channel_id>."));
    return;
  }
  await web.chat.postMessage({ channel: currentChannel, text });
}

rtm.on("message", (event) => {
  if (event.subtype !== "message_changed" && event.text) {
    const user = event.user || "system";
    console.log(chalk.cyan(`\n[${user}] ${event.text}`));
    rl.prompt();
  }
});

async function main() {
  console.clear();
  console.log(chalk.magenta.bold("TermoSlack"));
  console.log(chalk.gray("Type /help for commands.\n"));
  
  await rtm.start();
  await listChannels();

  rl.prompt();
  rl.on("line", async (line) => {
    const input = line.trim();

    if (input === "/exit") {
      console.log(chalk.gray("Exiting..."));
      process.exit(0);
    } else if (input.startsWith("/join ")) {
      currentChannel = input.split(" ")[1];
      console.log(chalk.green(`Joined channel ${currentChannel}`));
    } else if (input === "/help") {
      console.log(`
/join <channel_id>  - Join a channel
/exit               - Quit the app
Anything else       - Send message to current channel
      `);
    } else {
      await sendMessage(input);
    }
    rl.prompt();
  });
}

main();
