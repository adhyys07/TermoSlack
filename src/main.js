import { createUI } from './ui.js';
import chalk from "chalk";
import { createAuthServer } from './auth_server.js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import { saveSession, loadSession, listSessions } from './storage.js';
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
  let userClient = null;
  let rtmClient = null;
  let currentUserSession = null;

  ui.log(chalk.cyan.bold('\n=== TermoSlack - User-Based Slack Terminal Client ===\n'));
  ui.log(chalk.gray(`Runtime dir: ${runtimeDir}`));
  ui.log(chalk.gray(`Using .env: ${path.resolve(runtimeDir, '..', '.env')}`));

  // OAuth callback handler
  const auth = createAuthServer(async (oauthResult) => {
    if (!oauthResult.userToken || !oauthResult.teamId || !oauthResult.userId) {
      ui.log(chalk.red("OAuth success but missing user token, team ID, or user ID"));
      return;
    }

    const teamName = (oauthResult.result && oauthResult.result.team && oauthResult.result.team.name) || "(unknown)";
    saveSession(oauthResult.teamId, oauthResult.userId, { 
      userToken: oauthResult.userToken, 
      teamName 
    });
    ui.log(chalk.green(`✓ Authenticated as user ${oauthResult.userId} in workspace ${teamName}`));
    
    // Initialize user client
    userClient = new WebClient(oauthResult.userToken);
    currentUserSession = {
      userToken: oauthResult.userToken,
      teamId: oauthResult.teamId,
      userId: oauthResult.userId,
      teamName
    };

    // Load user's channels
    await loadUserChannels();

    // Start RTM for real-time events
    await startRTM(oauthResult.userToken);
  });

  ui.log(chalk.cyan(`\nTo authenticate, open: ${auth.loginUrl()}\n`));

  // Check for existing session
  const sessionList = listSessions();
  if (sessionList.length > 0) {
    const sessionKey = sessionList[0];
    const [teamId, userId] = sessionKey.split('_');
    const session = loadSession(teamId, userId);
    
    if (session && session.userToken) {
      try {
        userClient = new WebClient(session.userToken);
        const authTest = await userClient.auth.test();
        ui.log(chalk.green(`✓ Restored session for ${authTest.user} in ${session.teamName || teamId}`));
        currentUserSession = session;
        currentUserSession.userId = userId;
        currentUserSession.teamId = teamId;

        // Load channels
        await loadUserChannels();

        // Start RTM for real-time events
        await startRTM(session.userToken);
      } catch (e) {
        ui.log(chalk.yellow(`Saved session is invalid or expired. Please re-authenticate.`));
        ui.log(chalk.cyan(`OAuth URL: ${auth.loginUrl()}`));
      }
    }
  } else {
    ui.log(chalk.yellow("No saved sessions found. Please authenticate using the URL above."));
  }

  // Load user's channels
  async function loadUserChannels() {
    if (!userClient) return;
    
    try {
      const result = await userClient.users.conversations({
        types: "public_channel,private_channel,mpim,im",
        exclude_archived: true,
        limit: 1000
      });
      
      if (result.ok && result.channels) {
        ui.setChannels(result.channels);
        ui.log(chalk.gray(`Loaded ${result.channels.length} channels/DMs`));
      }
    } catch (e) {
      ui.log(chalk.red(`Failed to load channels: ${e.message}`));
    }
  }

  // Start RTM client for real-time events
  async function startRTM(userToken) {
    try {
      rtmClient = new RTMClient(userToken);
      
      rtmClient.on('message', async (event) => {
        // Only show messages from other users or other devices
        if (event.user && event.user !== currentUserSession.userId) {
          try {
            const userInfo = await userClient.users.info({ user: event.user });
            const name = (userInfo.user && (userInfo.user.real_name || userInfo.user.name)) || event.user;
            ui.addMessage(name, event.text || "<non-text message>");
          } catch {
            ui.addMessage(event.user, event.text || "<non-text message>");
          }
        }
      });

      rtmClient.on('reaction_added', (event) => {
        ui.log(chalk.gray(`Reaction :${event.reaction}: added by ${event.user}`));
      });

      rtmClient.on('error', (error) => {
        ui.log(chalk.red(`RTM Error: ${error.message}`));
      });

      await rtmClient.start();
      ui.log(chalk.green("✓ Connected to Slack RTM (real-time messaging)"));
    } catch (e) {
      ui.log(chalk.yellow(`Could not start RTM: ${e.message}`));
      ui.log(chalk.yellow("Real-time updates may not work, but you can still send messages."));
    }
  }

  // Handle channel selection
  ui.onChannelSelect(async (item, i) => {
    if (!userClient) {
      ui.log(chalk.red('Not authenticated. Please login first.'));
      return;
    }

    const chObj = ui.channelObjects && ui.channelObjects[i];
    if (!chObj || !chObj.id) {
      ui.log(chalk.red('Failed to determine channel id for selection'));
      return;
    }

    ui.currentChannel = chObj.id;
    ui.log(chalk.cyan(`\nSwitched to #${chObj.name}\n`));

    try {
      const hist = await userClient.conversations.history({ 
        channel: ui.currentChannel, 
        limit: 20 
      });
      
      ui.log(chalk.gray("--------- Recent Messages ---------"));
      for (const m of (hist.messages || []).reverse()) {
        let who = "unknown";
        if (m.user) {
          try {
            const userInfo = await userClient.users.info({ user: m.user });
            who = (userInfo.user && (userInfo.user.real_name || userInfo.user.name)) || m.user;
          } catch {
            who = m.user;
          }
        } else if (m.username) {
          who = m.username;
        }
        ui.addMessage(who, m.text || "<media/attachment>");
      }
      ui.log(chalk.gray("-----------------------------------\n"));
    } catch (err) {
      ui.log(chalk.red(`Failed to load messages: ${err.message}`));
    }
  });

  // Handle sending messages
  ui.onSend(async (msg) => {
    if (!ui.currentChannel) {
      ui.log(chalk.red("No channel selected"));
      return;
    }

    if (!userClient) {
      ui.log(chalk.red("Not authenticated. Please login first."));
      return;
    }

    try {
      await userClient.chat.postMessage({ 
        channel: ui.currentChannel, 
        text: msg 
      });
      ui.addMessage("You", msg);
      ui.log(chalk.green("✓ Message sent"));
    } catch (err) {
      ui.log(chalk.red(`Failed to send message: ${err.message}`));
      if (err.data && err.data.error === "not_in_channel") {
        ui.log(chalk.yellow("Try joining the channel first or select a different channel."));
      }
    }
  });

  ui.log(chalk.gray("\nTip: Use arrow keys to navigate channels, Enter to select, and type messages below.\n"));
}

main();
