import { WebClient } from "@slack/web-api";
import { SocketModeClient } from "@slack/socket-mode";
import {config} from "./config.js";

export class SlackClient {
    constructor() {
        this.web = new WebClient(config.botToken);
        this.socket = new SocketModeClient({
            appToken: config.appToken,
        })
        this.channels = [];
    }
    async start(onMessage){
        await this.rtm.start();
        this.rtm.on("message", (event) => {
            if (event.text && event.user) {
                onMessage(event.user, event.text);
            }
        });
        await this.socket.start();
    }

    async getChannels() {
        const res = await this.web.conversations.list();
        this.channels = res.channels;
        return this.channels;
    }

    async sendMessage(channelId, text) {
        await this.web.chat.postMessage({ channel, text });
    }

    async getUserName(userId) {
        try{
            const res = await this.web.users.info({ user: userId });
            return res.user.real_name || res.user.name;
        } catch {
            return "unknown";
        }
        }
    
}