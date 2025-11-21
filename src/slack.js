import { WebClient } from "@slack/web-api";
import { SocketModeClient } from "@slack/socket-mode";
import {config} from "./config.js";

export class SlackBot {
    constructor() {
        this.web = new WebClient(config.botToken);
        this.socket = new SocketModeClient({
            appToken: config.appToken,
            loglevel: "info"
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
        const res = await this.web.conversations.list();
        this.channels = res.channels;
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