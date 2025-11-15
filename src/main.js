import { createUI } from './ui.js';
import { SlackBot } from './slack.js';
import chalk from "chalk";
import { createAuthServer } from './auth_server.js';
import { config } from 'dotenv';
import { saveSession,loadSession,listSessions } from './storage.js';
import { sendMessageAsUser, getUserChannels, getUserName } from './user_client.js';

async function main() {
  const ui = createUI();
  const bot = new SlackBot();

  ui.log(chalk.gray("Connecting to Slack..."));

  const auth = createAuthServer(async (oauthResult) => {
    const userToken = oauthResult.authed_user && oauthResult.authed_user.access_token;
    const team = oauthResult.team && oauthResult.team.id;
    if (!usertoken || !team){
      ui.log(chalk.red("OAuth success but missing user token or team ID"));
      return;
    }
    saveSession(team, {userToken,teamName: oauthResult.team.name});
    ui.log(chalk.green(`Saved session for workspace ${oauthResult.team.name}`)); 
   });

   ui.log('Oauth URL : ${auth.loginUrl()}')

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
      ui.log(chalk.green("Bot connected (Socket Mode)."));

      const sessions = listSessions();
      if (sessions.length) ui.log(`Saved sessions: ${sessions.join(", ")}`);
      const chs = await bot.getChannels();
      ui.setChannels(chs);
      
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
    ui.log(chalk.red("Error connecting to Slack:"));
    console.error("FULL ERROR:", err);
    ui.log(String(err));
  }
}

main();