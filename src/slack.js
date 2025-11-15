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
        const res = await this.web.conversations.list();
        this.channels = res.channels;
        return this.channels;
    }
}