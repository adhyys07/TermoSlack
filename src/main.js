import { createUI } from './ui.js';
import { SlackBot } from './slack.js';
import chalk from "chalk";
import { createAuthServer } from './auth_server.js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import { saveSession,loadSession,listSessions } from './storage.js';
import { sendMessageAsUser, getUserChannels, getUserName } from './user_client.js';

async function main() {
  // Load .env from the runtime directory (works when running node or a packaged exe)
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  const runtimeDir = (process.pkg && process.execPath) ? path.dirname(process.execPath) : __dirname;
  try {
    dotenv.config({ path: path.resolve(runtimeDir, '..', '.env') });
  } catch (e) {
    console.error('Failed to load .env:', e);
  }

  // Crash logging so the exe doesn't just exit silently
  process.on('uncaughtException', (err) => {
    const logPath = path.resolve(runtimeDir, 'crash.log');
    const msg = `${new Date().toISOString()} UNCaughtException: ${String(err)}\n${err && err.stack ? err.stack : ''}\n\n`;
    try { fs.appendFileSync(logPath, msg); } catch (e) { console.error('Failed writing crash.log', e); }
    console.error('Fatal error, written to', logPath, err);
    process.exit(1);
  });

  process.on('unhandledRejection', (reason) => {
    const logPath = path.resolve(runtimeDir, 'crash.log');
    const msg = `${new Date().toISOString()} UnhandledRejection: ${String(reason)}\n\n`;
    try { fs.appendFileSync(logPath, msg); } catch (e) { console.error('Failed writing crash.log', e); }
    console.error('Unhandled rejection, written to', logPath, reason);
  });
  const ui = createUI();
  const bot = new SlackBot();

  // Connection diagnostics: show token presence and prefixes (masked)
  const mask = (t) => t ? `${t.slice(0,6)}...${t.slice(-4)}` : '(missing)';
  ui.log(chalk.gray(`Runtime dir: ${runtimeDir}`));
  ui.log(chalk.gray(`Using .env: ${path.resolve(runtimeDir, '..', '.env')}`));
  ui.log(chalk.gray(`SLACK_BOT_TOKEN: ${process.env.SLACK_BOT_TOKEN ? mask(process.env.SLACK_BOT_TOKEN) : 'NOT SET'}`));
  ui.log(chalk.gray(`SLACK_APP_TOKEN: ${process.env.SLACK_APP_TOKEN ? mask(process.env.SLACK_APP_TOKEN) : 'NOT SET'}`));

  ui.log(chalk.gray("Connecting to Slack..."));

  // Fail fast if tokens look wrong: warn if bot token missing or app token missing (for Socket Mode)
  if (!process.env.SLACK_BOT_TOKEN) ui.log(chalk.red("Warning: SLACK_BOT_TOKEN is not set. The app will not be able to authenticate."));
  if (!process.env.SLACK_APP_TOKEN) ui.log(chalk.yellow("Note: SLACK_APP_TOKEN (xapp-) may be required for Socket Mode."));

  // Connection timeout: if start() doesn't complete within 30s, write diagnostics and exit.
  const connectTimeoutMs = 30000;
  const connectTimeout = setTimeout(() => {
    const msg = `Connection timeout after ${connectTimeoutMs/1000}s. Check network and tokens.`;
    ui.log(chalk.red(msg));
    ui.log(chalk.red('Tips:'));
    ui.log(chalk.red('- Verify .env is next to the exe (or loaded when running with node).'));
    ui.log(chalk.red('- Ensure SLACK_BOT_TOKEN starts with xoxb- and is valid.'));
    ui.log(chalk.red('- For Socket Mode, ensure SLACK_APP_TOKEN (xapp-) is present and the app has Socket Mode enabled in Slack App settings.'));
    try { fs.appendFileSync(path.resolve(runtimeDir, 'crash.log'), `${new Date().toISOString()} Connection timeout\n`); } catch (e) {}
    process.exit(1);
  }, connectTimeoutMs);

  const auth = createAuthServer(async (oauthResult) => {
    const userToken = oauthResult.authed_user && oauthResult.authed_user.access_token;
    const team = oauthResult.team && oauthResult.team.id;
    if (!userToken || !team){
      ui.log(chalk.red("OAuth success but missing user token or team ID"));
      return;
    }
    saveSession(team, {userToken,teamName: oauthResult.team.name});
    ui.log(chalk.green(`Saved session for workspace ${oauthResult.team.name}`)); 
   });

   ui.log(`Oauth URL: ${auth.loginUrl()}`);

  try {
    await bot.start(async (ev) => {
      if (ev.type  === "message") {
        const nameR = await bot.web.users.info({ user: ev.user }).catch(() => null);
        const name = (nameR && (nameR.user.real_name || nameR.user.name)) || ev.user || "unknown";
        ui.addMessage(name, ev.text || "<non-text message>");
    } else if (ev.type === "reaction_added") {
      ui.log(`:${ev.reaction}: by ${ev.user}`);
    }
  });
      clearTimeout(connectTimeout);
      ui.log(chalk.green("Bot connected (Socket Mode)."));

      const sessions = listSessions();
      if (sessions.length) ui.log(`Saved sessions: ${sessions.join(", ")}`);
      const sessionList = listSessions();
      if (sessionList.length === 0) {
        ui.log("No User Saved Sessions found")
      } else{
        const teamId = sessionList[0];
        const session = loadSession(teamId);
        if (session && session.userToken) {
          const chs = await getUserChannels(session.userToken);
          ui.setChannels(chs);
      }else{
          ui.log("User token missing in session")
      }
    }
      ui.onChannelSelect(async (item, i) => {
        ui.currentChannel = bot.channels[i].id;
        ui.log(`Switched to #${item.getText()}`);
        const hist = await bot.web.conversations.history({channel: ui.currentChannel, limit: 20});
        ui.log("-----recent messages-----");
        (hist.messages || []).reverse().forEach(m => {
          const who = m.user || m.username || "unknown"
          ui.addMessage(who, m.text || "");
        });
      });
      ui.onSend(async (msg) =>{
        if (!ui.currentChannel) {
          ui.log(chalk.red("No channel selected"));
          return;
        }
        const chInfo = bot.channels.find(c => c.id === ui.currentChannel);
        const workspaceId = chInfo && chInfo.is_member ? chInfo.shared_team_ids ? chInfo.shared_team_ids[0] : null : null;

        const sessionsList = listSessions();
        if (sessionsList.length > 0) {
          const teamId = sessionsList[0];
          const session = loadSession(teamId);
          if (session && session.userToken) {
            await sendMessageAsUser(session.userToken, ui.currentChannel, msg);
            ui.addMessage("You", msg);
            return;
        }
      }
      await bot.web.chat.postMessage({channel: ui.currentChannel, text: msg});
      ui.addMessage("Bot", msg);
      });

      ui.log("To login (connect your Slack account), open the URL printed above in your browser (or open it from the UI).");
      ui.log("Tip: Run the /login endpoint to open browser: open the OAuth URL shown above.");
    }
    catch (err) {
    clearTimeout(connectTimeout);
    ui.log(chalk.red("Error connecting to Slack:"));
    console.error("FULL ERROR:", err);
    ui.log(String(err));
  }
}

main();