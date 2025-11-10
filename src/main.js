import { createUI } from './ui.js';
import { SlackClient } from './slack.js';
import chalk from "chalk";

async function main() {
  const ui = createUI();
  const slack = new SlackClient();

  ui.log(chalk.gray("Connecting to Slack..."));

  try {
    await slack.start(async (userId, text) => {
      const user = await slack.getUserName(userId);
      ui.addMessage(user, text);
    });
    
    const channels = await slack.getChannels();
    ui.setChannels(channels);
    ui.log(chalk.green("Connected to Slack! Select channel to start slaying !"))

    ui.onChannelSelect((item, index) => {
      ui.currentchannel = slack.channels[index].id;
      ui.log('Switched to #${item.getText()}')
    });
    
    ui.onSend(async (msg) => {
      if (!ui.currentchannel) {
        ui.log(chalk.red("Select a channel first!"));
        return;
      }

      await slack.sendMessage(ui.currentchannel, msg);
      ui.addMessage("Me", msg);
    });
  } catch (err) {
    ui.log(chalk.red("Error connecting to Slack: "));
    console.error(err);
  }
}
main();