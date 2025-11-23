import { createUI } from './ui.js';
import chalk from "chalk";
import { createAuthServer } from './auth_server.js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import { saveSession, loadSession, listSessions } from './storage.js';
import { WebClient } from '@slack/web-api';

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

  // Setup logging
  const logPath = path.resolve(runtimeDir, 'termoslack.log');
  
  function logToFile(level, message, error = null) {
    const timestamp = new Date().toISOString();
    let logMsg = `[${timestamp}] [${level}] ${message}`;
    if (error) {
      logMsg += `\n${error.stack || error}`;
    }
    logMsg += '\n';
    
    try {
      fs.appendFileSync(logPath, logMsg);
    } catch (e) {
      console.error('Failed to write to log file:', e);
    }
  }

  // Log startup
  logToFile('INFO', 'TermoSlack starting...');
  logToFile('INFO', `Runtime directory: ${runtimeDir}`);

  // Crash logging so the exe doesn't just exit silently
  process.on('uncaughtException', (err) => {
    const crashLog = path.resolve(runtimeDir, 'crash.log');
    const msg = `${new Date().toISOString()} UNCaughtException: ${String(err)}\n${err && err.stack ? err.stack : ''}\n\n`;
    try { fs.appendFileSync(crashLog, msg); } catch (e) { console.error('Failed writing crash.log', e); }
    logToFile('FATAL', 'Uncaught exception', err);
    console.error('Fatal error, written to', crashLog, err);
    process.exit(1);
  });

  process.on('unhandledRejection', (reason) => {
    const crashLog = path.resolve(runtimeDir, 'crash.log');
    const msg = `${new Date().toISOString()} UnhandledRejection: ${String(reason)}\n\n`;
    try { fs.appendFileSync(crashLog, msg); } catch (e) { console.error('Failed writing crash.log', e); }
    logToFile('ERROR', 'Unhandled rejection', reason instanceof Error ? reason : new Error(String(reason)));
    console.error('Unhandled rejection, written to', crashLog, reason);
  });

  const ui = createUI();
  let userClient = null;
  let currentUserSession = null;

  ui.log(chalk.cyan.bold('\n=== TermoSlack - User-Based Slack Terminal Client ===\n'));
  ui.log(chalk.gray(`Runtime dir: ${runtimeDir}`));
  ui.log(chalk.gray(`Using .env: ${path.resolve(runtimeDir, '..', '.env')}`));

  // OAuth callback handler
  const auth = createAuthServer(async (oauthResult) => {
    logToFile('INFO', 'OAuth callback received');
    
    if (!oauthResult.userToken || !oauthResult.teamId || !oauthResult.userId) {
      logToFile('ERROR', 'OAuth success but missing required fields');
      ui.log(chalk.red("OAuth success but missing user token, team ID, or user ID"));
      return;
    }

    const teamName = (oauthResult.result && oauthResult.result.team && oauthResult.result.team.name) || "(unknown)";
    logToFile('INFO', `User authenticated: ${oauthResult.userId} in workspace ${teamName}`);
    
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

    // Load user's channels (sorted alphabetically)
    await loadUserChannels();

    // Note: RTM is not supported for user tokens, skipping real-time events
    logToFile('INFO', 'Skipping RTM - not supported for user tokens');
    ui.log(chalk.yellow('Note: Real-time message updates are not available for user-based clients.'));
    ui.log(chalk.gray('You can still send and receive messages by selecting channels.'));
  });

  ui.log(chalk.cyan(`\nTo authenticate, open: ${auth.loginUrl()}\n`));

  // Check for existing session
  const sessionList = listSessions();
  if (sessionList.length > 0) {
    logToFile('INFO', `Found ${sessionList.length} saved session(s)`);
    const sessionKey = sessionList[0];
    const [teamId, userId] = sessionKey.split('_');
    const session = loadSession(teamId, userId);
    
    if (session && session.userToken) {
      try {
        logToFile('INFO', 'Attempting to restore session');
        userClient = new WebClient(session.userToken);
        const authTest = await userClient.auth.test();
        logToFile('INFO', `Session restored for user ${authTest.user}`);
        ui.log(chalk.green(`✓ Restored session for ${authTest.user} in ${session.teamName || teamId}`));
        currentUserSession = session;
        currentUserSession.userId = userId;
        currentUserSession.teamId = teamId;

        // Load channels
        await loadUserChannels();

        // Note: RTM is not supported for user tokens
        logToFile('INFO', 'Session restored, skipping RTM');
      } catch (e) {
        logToFile('WARN', 'Saved session is invalid or expired', e);
        ui.log(chalk.yellow(`Saved session is invalid or expired. Please re-authenticate.`));
        ui.log(chalk.cyan(`OAuth URL: ${auth.loginUrl()}`));
      }
    }
  } else {
    logToFile('INFO', 'No saved sessions found');
    ui.log(chalk.yellow("No saved sessions found. Please authenticate using the URL above."));
  }

  // Load user's channels
  async function loadUserChannels() {
    if (!userClient) return;
    
    try {
      logToFile('INFO', 'Loading user channels');
      const result = await userClient.users.conversations({
        types: "public_channel,private_channel",
        exclude_archived: true,
        limit: 1000
      });
      
      if (result.ok && result.channels) {
        // Filter to only channels (no DMs), sort alphabetically
        const channelList = result.channels.map((channel) => {
          if (channel.is_private || channel.is_group) {
            channel.displayName = `🔒 ${channel.name || channel.id}`;
          } else {
            channel.displayName = `# ${channel.name || channel.id}`;
          }
          return channel;
        });

        const sortedChannels = channelList.sort((a, b) => {
          const nameA = (a.name || '').toLowerCase();
          const nameB = (b.name || '').toLowerCase();
          return nameA.localeCompare(nameB);
        });
        ui.setChannels(sortedChannels);
        logToFile('INFO', `Loaded ${sortedChannels.length} channels`);
        ui.log(chalk.gray(`Loaded ${sortedChannels.length} channels`));
      }
    } catch (e) {
      logToFile('ERROR', 'Failed to load channels', e);
      ui.log(chalk.red(`Failed to load channels: ${e.message}`));
    }
  }

  // Handle channel selection
  ui.onChannelSelect(async (item, i) => {
    if (!userClient) {
      logToFile('WARN', 'Channel selection attempted without authentication');
      ui.log(chalk.red('Not authenticated. Please login first.'));
      return;
    }

    const chObj = ui.channelObjects && ui.channelObjects[i];
    if (!chObj || !chObj.id) {
      logToFile('ERROR', 'Failed to determine channel id for selection');
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
      logToFile('ERROR', `Failed to load messages for channel ${chObj.id}`, err);
      ui.log(chalk.red(`Failed to load messages: ${err.message}`));
    }
  });

  // Handle sending messages
  ui.onSend(async (msg) => {
    if (!ui.currentChannel) {
      logToFile('WARN', 'Message send attempted without channel selection');
      ui.log(chalk.red("No channel selected"));
      return;
    }

    if (!userClient) {
      logToFile('WARN', 'Message send attempted without authentication');
      ui.log(chalk.red("Not authenticated. Please login first."));
      return;
    }

    try {
      await userClient.chat.postMessage({ 
        channel: ui.currentChannel, 
        text: msg 
      });
      ui.addMessage("You", msg);
      logToFile('INFO', `Message sent to channel ${ui.currentChannel}`);
      ui.log(chalk.green("✓ Message sent"));
    } catch (err) {
      logToFile('ERROR', `Failed to send message to channel ${ui.currentChannel}`, err);
      ui.log(chalk.red(`Failed to send message: ${err.message}`));
      if (err.data && err.data.error === "not_in_channel") {
        ui.log(chalk.yellow("Try joining the channel first or select a different channel."));
      }
    }
  });

  ui.log(chalk.gray("\nTip: Use arrow keys to navigate channels, Enter to select, and type messages below.\n"));
}

main();
