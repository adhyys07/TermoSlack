import { WebClient } from "@slack/web-api";
import { SocketModeClient } from "@slack/socket-mode";
import {config} from "./config.js";

export class SlackBot {
    constructor() {
        // Validate token is a bot token to avoid accidental use of user tokens
        if (!config.botToken || !String(config.botToken).startsWith('xoxb-')) {
            console.error("SLACK_BOT_TOKEN is not a Bot token (must start with 'xoxb-'). Current token (masked):", String(config.botToken || '(missing)').slice(0,8) + '...');
            throw new Error("Invalid bot token used for WebClient. Ensure SLACK_BOT_TOKEN is the Bot User OAuth Token (xoxb-...) in .env and not overwritten by saved sessions.");
        }
        
        if (!config.appToken || !String(config.appToken).startsWith('xapp-')) {
            console.error("SLACK_APP_TOKEN is missing or not an app token (must start with 'xapp-'). Current token (masked):", String(config.appToken || '(missing)').slice(0,8) + '...');
            throw new Error("Invalid app token. Ensure SLACK_APP_TOKEN is set in .env and Socket Mode is enabled in your Slack App settings.");
        }
        
        this.web = new WebClient(config.botToken);
        this.socket = new SocketModeClient({
            appToken: config.appToken,
            logLevel: "error" // reduce noise, only show errors
        });
        
        // Add error handlers for Socket Mode
        this.socket.on('error', (error) => {
            console.error('Socket Mode error:', error.message);
            if (error.message && error.message.includes('408')) {
                console.error('Socket Mode timeout (408). Check:');
                console.error('1. SLACK_APP_TOKEN is valid and starts with xapp-');
                console.error('2. Socket Mode is enabled in Slack App → Socket Mode settings');
                console.error('3. Network/firewall allows WebSocket connections');
            }
        });
        
        this.socket.on('disconnect', (error) => {
            if (error) {
                console.error('Socket Mode disconnected:', error.message);
            }
        });
        
        this.channels = [];
    }
    async start(onEvent) {
    // Run an auth.test to verify the bot token is valid and has required scopes
    try {
      const auth = await this.web.auth.test();
      console.log(`auth.test OK — user:${auth.user || auth.user_id} team:${auth.team || auth.team_id}`);
    } catch (e) {
      // If Slack reports missing_scope, surface the needed/provided scopes in the error
      if (e && e.data && (e.data.error === 'missing_scope' || e.data.error === 'missing_required_scope')) {
        const needed = e.data.needed || (e.data.response_metadata && e.data.response_metadata.scopes && e.data.response_metadata.scopes.join(',')) || '(unknown)';
        const provided = e.data.provided || '(none)';
        console.error(`Slack auth.test missing_scope — needed: ${needed}; provided: ${provided}`);
        throw new Error(`Slack missing_scope: needed=${needed}; provided=${provided}`);
      }
      console.error('auth.test failed', e);
      throw e;
    }
    this.socket.on("events_api", async ({ envelope_id, payload }) => {
      const event = payload.event;

      try {await this.socket.ack(envelope_id);} catch (e) {}

      if (event && event.type === "message") {
        if (event.subtype == "message_changed") {
      } else {
        onEvent(event);
      }
    } else if (event && (event.type === "reaction_added" || event.type === "reaction_removed")) {
        onEvent(event);
    }
      });

    await this.socket.start();
  }

    async getChannels() {
      try {
        const res = await this.web.conversations.list({
          types: 'public_channel,private_channel',
          exclude_archived: true,
          limit: 200
        });
        // Filter to only show channels the bot/user is a member of
        this.channels = (res.channels || []).filter(ch => ch.is_member);
        return this.channels;
      } catch (e) {
        if (e && e.data && (e.data.error === 'missing_scope' || e.data.error === 'missing_required_scope')) {
          const needed = e.data.needed || (e.data.response_metadata && e.data.response_metadata.scopes && e.data.response_metadata.scopes.join(',')) || '(unknown)';
          const provided = e.data.provided || '(none)';
          console.error(`Slack API missing_scope when listing conversations — needed: ${needed}; provided: ${provided}`);
        }
        throw e;
      }
    }
}