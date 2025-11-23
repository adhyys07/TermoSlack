import { createUI } from './ui.js';
import chalk from "chalk";
import { createAuthServer } from './auth_server.js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import { saveSession,loadSession,listSessions } from './storage.js';
import { sendMessageAsUser, getUserChannels, getUserName } from './user_client.js';
import { WebClient } from '@slack/web-api';
import { RTMClient } from '@slack/rtm-api';

async function main() {
  // Load .env from the runtime directory (works when running node or a packaged exe)
  let __filename, __dirname, runtimeDir;
  
  if (process.pkg) {
    // Running as packaged executable
    __filename = process.execPath;
    __dirname = path.dirname(__filename);
    runtimeDir = __dirname;
  } else {
    // Running with Node.js
    __filename = fileURLToPath(import.meta.url);
    __dirname = path.dirname(__filename);
    runtimeDir = __dirname;
  }
  
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

  // helper to mask tokens for logs
  function mask(t) {
    if (!t) return 'NOT SET';
    const s = String(t);
    if (s.length <= 10) return s.replace(/.(?=.{2})/g, '*');
    return `${s.slice(0,6)}...${s.slice(-4)}`;
  }

  function handleSlackApiError(err) {
    if (!err || !err.data) return false;
    const data = err.data;
    if (data.error === "missing_scope" || data.error === "missing_required_scope") {
      const needed = data.needed || (data.response_metadata && data.response_metadata.scopes && data.response_metadata.scopes.join(',')) || '(unknown)';
      const provided = data.provided || '(none)';
      ui.log(chalk.red(`Slack API missing_scope error — needed: ${needed}; provided: ${provided}`));
      ui.log(chalk.yellow("Fix: In your Slack App → OAuth & Permissions add the missing Bot Token Scopes above, then click 'Install App' → 'Reinstall to Workspace'. After reinstall, update SLACK_BOT_TOKEN in .env and restart the app."));
      return true;
    }
    return false;
  }

  ui.log(chalk.gray(`Runtime dir: ${runtimeDir}`));
  ui.log(chalk.gray(`Using .env: ${path.resolve(runtimeDir, '..', '.env')}`));

  ui.log(chalk.gray("Starting TermoSlack as user-based Slack client..."));
    try { fs.appendFileSync(path.resolve(runtimeDir, 'crash.log'), `${new Date().toISOString()} Connection timeout\n`); } catch (e) {}
    process.exit(1);
  }, connectTimeoutMs);

  const auth = createAuthServer(async (oauthResult) => {
    const normalized = {
      result: oauthResult.result || oauthResult,
      userToken: oauthResult.userToken,
      teamId: oauthResult.teamId,
      userId: oauthResult.userId
    };

    if (!normalized.userToken || !normalized.teamId || !normalized.userId) {
      ui.log(chalk.red("OAuth success but missing user token, team ID, or user ID"));
      return;
    }

    const teamName = (normalized.result && normalized.result.team && normalized.result.team.name) || normalized.result.teamName || "(unknown)";
    saveSession(normalized.teamId, normalized.userId, { userToken: normalized.userToken, teamName });
    ui.log(chalk.green(`Saved session for workspace ${teamName} (user: ${normalized.userId})`));
    
    // Load user's channels after successful authentication
    try {
      const userClient = new WebClient(normalized.userToken);
      const result = await userClient.users.conversations({
        types: "public_channel,private_channel,mpim,im",
        exclude_archived: true,
        limit: 1000
      });
      
      if (result.ok && result.channels) {
        ui.setChannels(result.channels);
        ui.log(chalk.green(`✓ Loaded ${result.channels.length} channels you're a member of`));
      }
    } catch (e) {
      ui.log(chalk.yellow(`Could not load channels after login: ${e.message}`));
    }
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
      let currentUserSession = null;
      
      if (sessionList.length > 0) {
        // For now, use the first session (format: teamId_userId)
        const sessionKey = sessionList[0];
        const [teamId, userId] = sessionKey.split('_');
        const session = loadSession(teamId, userId);
        
        if (session && session.userToken) {
          // Verify the session is still valid
          try {
            const userClient = new WebClient(session.userToken);
            const authTest = await userClient.auth.test();
            ui.log(chalk.green(`Restored session for ${authTest.user} in ${session.teamName || teamId}`));
            currentUserSession = session;
          } catch (e) {
            ui.log(chalk.yellow(`Saved session is invalid or expired. Please re-authenticate.`));
            ui.log(chalk.cyan(`OAuth URL: ${auth.loginUrl()}`));
          }
        }
      } else {
        ui.log(chalk.yellow("No saved sessions found."));
        ui.log(chalk.cyan(`To authenticate, open: ${auth.loginUrl()}`));
      }
      
      if (currentUserSession && currentUserSession.userToken) {
        // Load channels using USER token (shows channels the authenticated user is in)
        try {
          const userClient = new WebClient(currentUserSession.userToken);
          const result = await userClient.users.conversations({
            types: "public_channel,private_channel",
            exclude_archived: true,
            limit: 1000
          });
          
          if (result.ok && result.channels) {
            ui.setChannels(result.channels);
            ui.log(chalk.gray(`Loaded ${result.channels.length} channels for authenticated user`));
          } else {
            throw new Error("Failed to fetch user channels");
          }
        } catch (e) {
          ui.log(chalk.yellow(`Could not load user channels: ${e.message}`));
          // Fallback to bot channels
          try {
            await bot.getChannels();
            ui.setChannels(bot.channels);
            ui.log(chalk.gray(`Loaded ${bot.channels.length} bot channels (fallback)`));
          } catch (botErr) {
            ui.log(chalk.red(`Failed to load channels: ${botErr.message}`));
          }
        }
      } else {
        // No valid session - show bot channels as fallback
        try {
          await bot.getChannels();
          ui.setChannels(bot.channels);
          ui.log(chalk.gray(`Loaded ${bot.channels.length} bot channels`));
        } catch (e) {
          ui.log(chalk.red(`Failed to load channels: ${e.message}`));
        }
      }
      ui.onChannelSelect(async (item, i) => {
        // Use UI's stored channel objects so index maps correctly to id
        const chObj = ui.channelObjects && ui.channelObjects[i];
        if (!chObj || !chObj.id) {
          ui.log(chalk.red('Failed to determine channel id for selection'));
          return;
        }
        ui.currentChannel = chObj.id;
        ui.log(`Switched to #${chObj.name}`);
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

        const sessionsList = listSessions();
        let sentAsUser = false;

        // Try to send as user first if we have a session with user token
        if (sessionsList.length > 0) {
          const teamId = sessionsList[0];
          const session = loadSession(teamId);
          if (session && session.userToken) {
            try {
              await sendMessageAsUser(session.userToken, ui.currentChannel, msg);
              ui.addMessage("You", msg);
              ui.log(chalk.green("✓ Message sent as user"));
              sentAsUser = true;
            } catch (e) {
              ui.log(chalk.yellow(`Sending as user failed: ${e.message}. Falling back to bot...`));
            }
          }
        }

        // If user send failed or no user token, send as bot
        if (!sentAsUser) {
          try {
            await bot.web.chat.postMessage({ channel: ui.currentChannel, text: msg });
            ui.addMessage("Bot", msg);
            ui.log(chalk.gray("✓ Message sent as bot"));
          } catch (err) {
            const apiError = err && err.data && err.data.error ? err.data.error : null;
            if (apiError === "not_in_channel" || /not_in_channel/i.test(String(err))) {
              ui.log(chalk.yellow("Bot is not in the channel — attempting to join..."));
              try {
                await bot.web.conversations.join({ channel: ui.currentChannel });
                await bot.web.chat.postMessage({ channel: ui.currentChannel, text: msg });
                ui.addMessage("Bot", msg);
                ui.log(chalk.green("✓ Bot joined the channel and message was sent."));
              } catch (joinErr) {
                ui.log(chalk.red("Failed to join channel or send message as bot: " + String(joinErr)));
              }
            } else {
              ui.log(chalk.red("Failed to send message as bot: " + String(err)));
            }
          }
        }
      });

      ui.log("To login (connect your Slack account), open the URL printed above in your browser (or open it from the UI).");
      ui.log("Tip: Run the /login endpoint to open browser: open the OAuth URL shown above.");
    }
    catch (err) {
    clearTimeout(connectTimeout);
    ui.log(chalk.red("Error connecting to Slack:"));
    // If this is a missing_scope platform error, show actionable guidance
    if (handleSlackApiError(err)) {
      // handled and message shown
    } else if (err && err.data && err.data.error === 'missing_scope') {
      // fallback: parse data
      const needed = err.data.needed || '(unknown)';
      const provided = err.data.provided || '(none)';
      ui.log(chalk.red(`Slack API missing_scope — needed: ${needed}; provided: ${provided}`));
      ui.log(chalk.yellow("Fix: Add missing Bot Token Scopes in Slack App → OAuth & Permissions, then reinstall and update SLACK_BOT_TOKEN."));
    } else {
      console.error("FULL ERROR:", err);
      ui.log(String(err));
    }
  }
}

main();